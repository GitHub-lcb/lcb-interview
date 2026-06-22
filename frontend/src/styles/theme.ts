import type { ThemeConfig } from 'antd'

const theme: ThemeConfig = {
  token: {
    colorPrimary: '#2563EB',
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#FAFAF9',
    colorText: '#18181B',
    colorTextSecondary: '#71717A',
    colorBorder: '#E4E4E7',
    colorBorderSecondary: '#F1F1F3',
    borderRadius: 8,
    borderRadiusLG: 12,
    fontSize: 14,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: 16,
    paddingLG: 24,
    marginLG: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
    boxShadowSecondary: '0 4px 20px rgba(0,0,0,0.06)',
    colorBgElevated: '#FFFFFF',
    colorFillAlter: '#F8F8FA',
    colorFillContent: '#F4F4F5',
  },
  components: {
    Card: {
      paddingLG: 24,
      colorBorderSecondary: '#E4E4E7',
    },
    Collapse: {
      contentBg: '#FFFFFF',
      headerBg: '#FAFAF9',
      colorBorder: '#E4E4E7',
    },
    Menu: {
      itemBorderRadius: 8,
      itemBg: '#FFFFFF',
      itemActiveBg: '#DBEAFE',
      itemSelectedBg: '#DBEAFE',
      itemHoverBg: '#F4F4F5',
      itemColor: '#52525B',
      itemHoverColor: '#18181B',
      itemSelectedColor: '#1D4ED8',
    },
    Layout: {
      headerBg: '#FFFFFF',
      bodyBg: '#FAFAF9',
      siderBg: '#FFFFFF',
    },
    Table: {
      headerBg: '#FAFAF9',
      headerColor: '#52525B',
      rowHoverBg: '#F8F8FA',
    },
    Tag: {
      defaultBg: '#F4F4F5',
      defaultColor: '#52525B',
    },
    Button: {
      primaryShadow: 'none',
      fontWeight: 500,
    },
    List: {
      headerBg: 'transparent',
      footerBg: 'transparent',
    },
    Tabs: {
      inkBarColor: '#2563EB',
      itemSelectedColor: '#2563EB',
      itemHoverColor: '#2563EB',
      itemColor: '#71717A',
    },
    Progress: {
      defaultColor: '#2563EB',
      remainingColor: '#F1F1F3',
    },
    Pagination: {
      itemBg: '#FFFFFF',
      itemActiveBg: '#2563EB',
    },
  },
}

export default theme
