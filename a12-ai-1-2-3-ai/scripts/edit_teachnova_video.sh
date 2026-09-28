#!/usr/bin/env bash
set -euo pipefail

INPUT="/Users/huanglinhao/Desktop/服务外包省赛/1D7674DC-DD1D-41C5-93DB-A4DCC286C025.mov"
OUTPUT_DIR="/Users/huanglinhao/Desktop/服务外包省赛/a12-ai-1-2-3-ai/outputs/video"
SUBTITLES="/Users/huanglinhao/Desktop/服务外包省赛/a12-ai-1-2-3-ai/outputs/TeachNova_项目演示字幕.srt"
FONT="/Library/Fonts/Arial Unicode.ttf"

mkdir -p "$OUTPUT_DIR"

FILTER="drawbox=x=110:y=284:w=740:h=72:color=0xEFF4FC:t=fill:enable='between(t,0,7.55)',drawbox=x=155:y=415:w=650:h=55:color=0xEFF4FC:t=fill:enable='between(t,0,7.55)',drawtext=fontfile='$FONT':text='文档解析':fontsize=18:fontcolor=0x234F99:x=144:y=311:enable='between(t,0.45,7.55)',drawtext=fontfile='$FONT':text='课件生成':fontsize=18:fontcolor=0x234F99:x=264:y=311:enable='between(t,1.05,7.55)',drawtext=fontfile='$FONT':text='PPT创作':fontsize=18:fontcolor=0x234F99:x=384:y=311:enable='between(t,1.65,7.55)',drawtext=fontfile='$FONT':text='语音交互':fontsize=18:fontcolor=0x234F99:x=504:y=311:enable='between(t,2.25,7.55)',drawtext=fontfile='$FONT':text='本地知识库':fontsize=18:fontcolor=0x234F99:x=615:y=311:enable='between(t,2.85,7.55)',drawtext=fontfile='$FONT':text='教学智能体':fontsize=18:fontcolor=0x234F99:x=735:y=311:enable='between(t,3.45,7.55)',drawtext=fontfile='$FONT':text='中国大学生服务外包创新创业大赛':fontsize=16:fontcolor=0x315A99:x=(w-text_w)/2:y=423:enable='between(t,4.25,7.55)',drawtext=fontfile='$FONT':text='大猛男团队':fontsize=17:fontcolor=0x315A99:x=(w-text_w)/2:y=447:enable='between(t,5.25,7.55)',drawbox=x=466:y=125:w=430:h=238:color=0xF1F6FC:t=fill:enable='between(t,66.8,98.6)',drawbox=x=478:y=137:w=195:h=96:color=white:t=fill:enable='between(t,66.8,98.6)',drawbox=x=682:y=137:w=195:h=96:color=white:t=fill:enable='between(t,66.8,98.6)',drawbox=x=478:y=247:w=195:h=100:color=white:t=fill:enable='between(t,66.8,98.6)',drawbox=x=682:y=247:w=195:h=100:color=white:t=fill:enable='between(t,66.8,98.6)',drawtext=fontfile='$FONT':text='工具割裂':fontsize=20:fontcolor=0x285EAD:x=493:y=156:enable='between(t,67,98.6)',drawtext=fontfile='$FONT':text='教材、课件与资料':fontsize=13:fontcolor=0x4E6075:x=493:y=188:enable='between(t,67,98.6)',drawtext=fontfile='$FONT':text='需要在多种工具间切换':fontsize=13:fontcolor=0x4E6075:x=493:y=207:enable='between(t,67,98.6)',drawtext=fontfile='$FONT':text='制作耗时':fontsize=20:fontcolor=0x285EAD:x=697:y=156:enable='between(t,73.5,98.6)',drawtext=fontfile='$FONT':text='排版、配图、整理讲稿':fontsize=13:fontcolor=0x4E6075:x=697:y=188:enable='between(t,73.5,98.6)',drawtext=fontfile='$FONT':text='占用大量备课时间':fontsize=13:fontcolor=0x4E6075:x=697:y=207:enable='between(t,73.5,98.6)',drawtext=fontfile='$FONT':text='意图理解浅':fontsize=20:fontcolor=0x285EAD:x=493:y=266:enable='between(t,80,98.6)',drawtext=fontfile='$FONT':text='单轮指令难把握教学目标':fontsize=13:fontcolor=0x4E6075:x=493:y=298:enable='between(t,80,98.6)',drawtext=fontfile='$FONT':text='学情与课堂节奏':fontsize=13:fontcolor=0x4E6075:x=493:y=317:enable='between(t,80,98.6)',drawtext=fontfile='$FONT':text='迭代成本高':fontsize=20:fontcolor=0x285EAD:x=697:y=266:enable='between(t,86.5,98.6)',drawtext=fontfile='$FONT':text='修改需要重复调整':fontsize=13:fontcolor=0x4E6075:x=697:y=298:enable='between(t,86.5,98.6)',drawtext=fontfile='$FONT':text='版本难继承、难追踪':fontsize=13:fontcolor=0x4E6075:x=697:y=317:enable='between(t,86.5,98.6)'"

ffmpeg -y -hide_banner -loglevel error -i "$INPUT" -an -vf "$FILTER" \
  -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -r 30 "$OUTPUT_DIR/base.mp4"

ffmpeg -y -hide_banner -loglevel error -ss 130 -i "$OUTPUT_DIR/base.mp4" \
  -frames:v 1 -q:v 2 "$OUTPUT_DIR/architecture.jpg"

ffmpeg -y -hide_banner -loglevel error -loop 1 -framerate 30 -t 0.8 \
  -i "$OUTPUT_DIR/architecture.jpg" \
  -vf "drawbox=x=0:y=0:w=iw:h=54:color=0x122845@0.76:t=fill,drawtext=fontfile='$FONT':text='TeachNova 项目整体架构':fontsize=26:fontcolor=white:x=(w-text_w)/2:y=12" \
  -an -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -r 30 "$OUTPUT_DIR/arch-overview.mp4"

make_zoom() {
  local name="$1" crop="$2" label="$3"
  ffmpeg -y -hide_banner -loglevel error -loop 1 -framerate 30 -t 1.2 \
    -i "$OUTPUT_DIR/architecture.jpg" \
    -vf "crop=$crop,scale=960:480:force_original_aspect_ratio=increase:flags=lanczos,crop=960:480,unsharp=7:7:1.2:5:5:0,drawbox=x=0:y=0:w=iw:h=54:color=0x122845@0.82:t=fill,drawtext=fontfile='$FONT':text='$label':fontsize=26:fontcolor=white:x=(w-text_w)/2:y=12" \
    -an -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -r 30 "$OUTPUT_DIR/$name.mp4"
}

make_zoom "zoom-01-multisource" "190:150:120:20" "多源资料输入"
make_zoom "zoom-02-agent-workflow" "190:150:120:174" "Agent 工作流"
make_zoom "zoom-03-agent-assistant" "190:150:120:326" "Agent 智能助手"
make_zoom "zoom-04-kb-model" "195:150:642:20" "知识库与模型配置"
make_zoom "zoom-05-courseware" "195:150:642:174" "课件与教案生成"

ffmpeg -y -hide_banner -loglevel error -i "$OUTPUT_DIR/base.mp4" -t 128.7 -an \
  -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -r 30 "$OUTPUT_DIR/head.mp4"
ffmpeg -y -hide_banner -loglevel error -i "$OUTPUT_DIR/base.mp4" -ss 132.9 -t 68.533333 -an \
  -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -r 30 "$OUTPUT_DIR/tail.mp4"

ffmpeg -y -hide_banner -loglevel error \
  -i "$OUTPUT_DIR/head.mp4" -i "$OUTPUT_DIR/arch-overview.mp4" \
  -i "$OUTPUT_DIR/zoom-01-multisource.mp4" -i "$OUTPUT_DIR/zoom-02-agent-workflow.mp4" \
  -i "$OUTPUT_DIR/zoom-03-agent-assistant.mp4" -i "$OUTPUT_DIR/zoom-04-kb-model.mp4" \
  -i "$OUTPUT_DIR/zoom-05-courseware.mp4" -i "$OUTPUT_DIR/tail.mp4" \
  -filter_complex "[0:v][1:v][2:v][3:v][4:v][5:v][6:v][7:v]concat=n=8:v=1:a=0,subtitles=filename='$SUBTITLES':force_style='FontName=Arial Unicode MS,FontSize=18,Outline=1.5,Shadow=0,BorderStyle=3,BackColour=&H99000000&,MarginV=14,Alignment=2',scale=1920:960:flags=lanczos,format=yuv420p[v]" \
  -map "[v]" -an -c:v libx264 -preset medium -crf 18 -movflags +faststart \
  "$OUTPUT_DIR/TeachNova_项目演示_字幕与架构特写.mp4"
