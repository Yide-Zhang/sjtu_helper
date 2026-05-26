declare module 'react-native-vector-icons/MaterialIcons' {
  import { Component } from 'react';
  import { TextProps } from 'react-native';
  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
    style?: any;
  }
  export default class MaterialIcons extends Component<IconProps> {}
}

declare module '@react-native-cookies/cookies' {
  interface Cookie {
    name: string;
    value: string;
    path?: string;
    domain?: string;
    version?: string;
    expires?: string;
    secure?: boolean;
    httpOnly?: boolean;
  }
  interface CookieManagerStatic {
    set(url: string, cookie: Partial<Cookie> & { name: string; value: string }): Promise<boolean>;
    get(url: string): Promise<Record<string, Cookie>>;
    clearAll(): Promise<boolean>;
  }
  const CookieManager: CookieManagerStatic;
  export default CookieManager;
}

declare module 'markdown-it/lib/index' {
  import MarkdownIt from 'markdown-it';
  export default MarkdownIt;
}
