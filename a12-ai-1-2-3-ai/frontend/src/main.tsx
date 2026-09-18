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
          colorPrimary: '#2563eb',
          colorInfo: '#0891b2',
          colorSuccess: '#16a34a',
          colorWarning: '#d97706',
          borderRadius: 8,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
        components: {
          Card: { borderRadiusLG: 8 },
          Button: { borderRadius: 8, controlHeight: 36 },
          Input: { borderRadius: 8 },
          Layout: { siderBg: '#0f172a', bodyBg: '#f6f8fb' },
          Menu: { darkItemBg: '#0f172a', darkSubMenuItemBg: '#0f172a' },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
