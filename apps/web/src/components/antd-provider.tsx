'use client';

import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App, ConfigProvider, theme } from 'antd';

/**
 * AntdRegistry collects antd's css-in-js output during SSR so the first paint
 * is already styled. ConfigProvider holds the design tokens for the whole app.
 *
 * The hex values here mirror the `@theme` block in globals.css — antd cannot
 * read Tailwind's custom properties at token-resolution time, so the two lists
 * have to be kept in sync by hand.
 */
export function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#1c1c1c',
            colorInfo: '#1c1c1c',
            colorText: '#1c1c1c',
            colorTextSecondary: '#5c5c5c',
            colorTextTertiary: '#8a8a8a',
            colorBorder: '#e0e0e0',
            colorBorderSecondary: '#ededed',
            colorBgLayout: '#fafafa',
            colorFillTertiary: '#f2f2f2',
            borderRadius: 8,
            controlHeight: 36,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          },
          components: {
            Layout: {
              // The sidebar and the area behind the content panel share one
              // tone, so the sidebar reads as page background rather than a
              // separate column with a divider.
              siderBg: '#fafafa',
              bodyBg: '#fafafa',
            },
            Menu: {
              itemHeight: 36,
              itemMarginInline: 8,
              itemMarginBlock: 2,
              itemBorderRadius: 8,
              itemPaddingInline: 10,
              itemColor: '#5c5c5c',
              itemHoverBg: '#f2f2f2',
              itemHoverColor: '#1c1c1c',
              itemSelectedBg: '#ebebeb',
              itemSelectedColor: '#1c1c1c',
              iconSize: 18,
              collapsedIconSize: 18,
              iconMarginInlineEnd: 10,
            },
            Button: {
              defaultShadow: 'none',
              primaryShadow: 'none',
              textHoverBg: '#f2f2f2',
            },
          },
        }}
      >
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
