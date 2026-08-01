import type { ThemeConfig } from 'antd'

/**
 * 「墨纸实验室」主题令牌：坐标纸底色 + 墨迹文字 + 青绿强调，
 * 对齐粒子先生物理实验室的手工教科书质感，AntD 全站组件统一换肤。
 */
const theme: ThemeConfig = {
  token: {
    colorPrimary: '#0F8A8F',
    colorInfo: '#0F8A8F',
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#EEF1F4',
    colorText: '#1A1E23',
    colorTextSecondary: '#586069',
    colorBorder: '#D3D9DF',
    colorBorderSecondary: '#E4E9ED',
    borderRadius: 8,
    borderRadiusLG: 12,
    fontSize: 14,
    fontFamily: "'HarmonyOS Sans SC', 'PingFang SC', 'Microsoft YaHei UI', 'Microsoft YaHei', system-ui, -apple-system, sans-serif",
    padding: 16,
    paddingLG: 24,
    marginLG: 24,
    boxShadow: '0 1px 3px rgba(74, 56, 28, 0.06), 0 1px 2px rgba(74, 56, 28, 0.04)',
    boxShadowSecondary: '0 10px 26px rgba(74, 56, 28, 0.08)',
    colorBgElevated: '#FFFFFF',
    colorFillAlter: '#F2F6F7',
    colorFillContent: '#E7ECEF',
  },
  components: {
    Card: {
      paddingLG: 24,
      colorBorderSecondary: '#D3D9DF',
    },
    Collapse: {
      contentBg: '#FFFFFF',
      headerBg: '#F2F6F7',
      colorBorder: '#D3D9DF',
    },
    Menu: {
      itemBorderRadius: 8,
      itemBg: '#FFFFFF',
      itemActiveBg: '#E7F3EC',
      itemSelectedBg: '#E7F3EC',
      itemHoverBg: '#F2F6F7',
      itemColor: '#4E5960',
      itemHoverColor: '#1A1E23',
      itemSelectedColor: '#0F8A8F',
    },
    Layout: {
      headerBg: '#FFFFFF',
      bodyBg: '#EEF1F4',
      siderBg: '#FFFFFF',
    },
    Table: {
      headerBg: '#F2F6F7',
      headerColor: '#4E5960',
      rowHoverBg: '#F4F7F8',
    },
    Tag: {
      defaultBg: '#E7F3EC',
      defaultColor: '#0F8A8F',
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
      inkBarColor: '#0F8A8F',
      itemSelectedColor: '#0F8A8F',
      itemHoverColor: '#0F8A8F',
      itemColor: '#586069',
    },
    Progress: {
      defaultColor: '#0F8A8F',
      remainingColor: '#E4E9ED',
    },
    Pagination: {
      itemBg: '#FFFFFF',
      itemActiveBg: '#0F8A8F',
    },
    Segmented: {
      itemSelectedBg: '#FFFFFF',
      itemSelectedColor: '#0F8A8F',
      trackBg: '#E7ECEF',
    },
  },
}

export default theme
