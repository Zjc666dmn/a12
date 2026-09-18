import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#5876df',
          colorInfo: '#5876df',
          colorSuccess: '#45a978',
          colorWarning: '#d99443',
          colorText: '#263b5d',
          colorTextSecondary: '#7f8da1',
          colorBorder: '#e2e8ef',
          borderRadius: 10,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
        components: {
          Card: { borderRadiusLG: 16 },
          Button: { borderRadius: 10, controlHeight: 36 },
          Input: { borderRadius: 10 },
          Modal: { borderRadiusLG: 18 },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
