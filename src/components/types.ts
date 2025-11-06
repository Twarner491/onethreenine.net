export interface BoardItem {
  id: string;
  type: 'note' | 'photo' | 'list' | 'receipt' | 'menu';
  x: number;
  y: number;
  content: any;
  rotation?: number;
  color?: string;
}

export interface User {
  id: string;
  name: string;
  color: string;
  twitterHandle?: string;
  profilePic?: string;
}

