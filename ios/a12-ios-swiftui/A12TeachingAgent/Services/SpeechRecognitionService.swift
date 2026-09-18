import AVFoundation
import Foundation
import Speech

/// Native Chinese speech-to-text input used by the home composer and Studio revision box.
final class SpeechRecognitionService: NSObject, ObservableObject {
    @Published private(set) var isListening = false
    @Published private(set) var transcript = ""
    @Published private(set) var errorMessage: String?

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh-CN"))
    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var baseText = ""

    func toggle(baseText: String) {
        if isListening {
            stop()
            return
        }

        self.baseText = baseText.trimmingCharacters(in: .whitespacesAndNewlines)
        transcript = self.baseText
        errorMessage = nil

        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized:
            requestMicrophoneAndStart()
        case .notDetermined:
            SFSpeechRecognizer.requestAuthorization { [weak self] status in
                DispatchQueue.main.async {
                    guard let self else { return }
                    guard status == .authorized else {
                        self.fail(self.message(for: status))
                        return
                    }
                    self.requestMicrophoneAndStart()
                }
            }
        case .denied:
            fail("语音识别权限已关闭，请在系统设置中允许 TeachNova 使用语音识别")
        case .restricted:
            fail("当前设备不允许使用语音识别")
        @unknown default:
            fail("语音识别不可用")
        }
    }

    func stop() {
        guard isListening || recognitionTask != nil else { return }
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        isListening = false
    }

    private func requestMicrophoneAndStart() {
        AVAudioApplication.requestRecordPermission { [weak self] granted in
            DispatchQueue.main.async {
                guard let self else { return }
                guard granted else {
                    self.fail("麦克风权限已关闭，请在系统设置中允许 TeachNova 使用麦克风")
                    return
                }
                self.startRecording()
            }
        }
    }

    private func startRecording() {
#if targetEnvironment(simulator)
        // Simulator permission prompts can be accepted even when no audio
        // input route exists. AVAudioEngine then aborts inside installTap;
        // leave the simulator on a safe informational path instead.
        fail("模拟器不提供稳定的麦克风输入，请使用真机测试语音识别")
        return
#else
        guard let recognizer, recognizer.isAvailable else {
            fail("语音识别服务暂时不可用，请稍后重试")
            return
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        recognitionRequest = request
        let inputNode = audioEngine.inputNode

        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
            inputNode.removeTap(onBus: 0)
            let recordingFormat = inputNode.outputFormat(forBus: 0)
            // The iOS Simulator may report a zero-channel/zero-rate input even
            // after the permission dialog is accepted. AVAudioEngine would
            // abort inside installTap for that format instead of throwing.
            guard recordingFormat.sampleRate > 0, recordingFormat.channelCount > 0 else {
                try? audioSession.setActive(false, options: .notifyOthersOnDeactivation)
                fail("模拟器没有可用的麦克风输入，请使用真机测试语音识别")
                return
            }
            inputNode.installTap(onBus: 0, bufferSize: 1_024, format: recordingFormat) { [weak self] buffer, _ in
                self?.recognitionRequest?.append(buffer)
            }
            audioEngine.prepare()
            try audioEngine.start()
            isListening = true

            recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                let recognizedText = result?.bestTranscription.formattedString
                DispatchQueue.main.async {
                    guard let self else { return }
                    if let recognizedText, !recognizedText.isEmpty {
                        self.transcript = [self.baseText, recognizedText]
                            .filter { !$0.isEmpty }
                            .joined(separator: self.baseText.isEmpty ? "" : " ")
                    }
                    if let error, self.isListening {
                        self.stop()
                        self.fail("语音识别失败：\(error.localizedDescription)")
                    }
                }
            }
        } catch {
            stop()
            fail("无法启动麦克风：\(error.localizedDescription)")
        }
#endif
    }

    private func fail(_ message: String) {
        errorMessage = message
        isListening = false
    }

    private func message(for status: SFSpeechRecognizerAuthorizationStatus) -> String {
        switch status {
        case .denied:
            return "语音识别权限已关闭，请在系统设置中允许 TeachNova 使用语音识别"
        case .restricted:
            return "当前设备不允许使用语音识别"
        default:
            return "无法获得语音识别权限"
        }
    }

    deinit {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionTask?.cancel()
    }
}
