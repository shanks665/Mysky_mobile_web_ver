export const theme = {
  colors: {
    primary: '#4E7CFF',        // メインカラー（アクション、重要ボタン）
    secondary: '#FF6B6B',      // サブカラー（アクセント）
    background: '#F9F9F9',     // 背景色
    surface: '#FFFFFF',        // カード、ダイアログなどの表面
    card: '#FFFFFF',           // カード背景色
    text: {
      primary: '#212121',      // メインテキスト
      secondary: '#757575',    // 補足テキスト
      disabled: '#BDBDBD',     // 無効テキスト
      inverse: '#FFFFFF',      // 背景が濃い色の時のテキスト
    },
    border: '#E0E0E0',         // 境界線
    success: '#4CAF50',        // 成功状態
    error: '#F44336',          // エラー状態
    warning: '#FFC107',        // 警告状態
    info: '#2196F3',           // 情報状態
    distance: {
      close: '#4CAF50',        // 近距離
      medium: '#FFC107',       // 中距離
      far: '#757575',          // 遠距離
    },
    // チャット背景用テーマ
    chatThemes: {
      default: {
        background: '#F5F5F5',
        myBubble: '#4E7CFF',
        otherBubble: '#FFFFFF',
      },
      light: {
        background: '#FFFFFF',
        myBubble: '#4E7CFF',
        otherBubble: '#F5F5F5',
      },
      dark: {
        background: '#121212',
        myBubble: '#3949AB',
        otherBubble: '#424242',
      },
      pastel: {
        background: '#FCF7F8',
        myBubble: '#CDB4DB',
        otherBubble: '#FFC8DD',
      },
      nature: {
        background: '#EFFAF5',
        myBubble: '#2A9D8F',
        otherBubble: '#E9F5DB',
      },
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    xl: 24,
    circle: 9999,
  },
  typography: {
    fontFamily: {
      regular: 'Roboto-Regular',
      medium: 'Roboto-Medium',
      bold: 'Roboto-Bold',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.18,
      shadowRadius: 1.0,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.23,
      shadowRadius: 2.62,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.30,
      shadowRadius: 4.65,
      elevation: 8,
    },
  }
}; 