import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Yeverse — 私人藏品馆',description:'那些重要的物品，和留在它们身上的故事。',manifest:'/manifest.webmanifest',icons:{icon:'/favicon.svg',apple:'/icon-192.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><head><meta name="theme-color" content="#101112"/><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/><meta name="apple-mobile-web-app-capable" content="yes"/></head><body>{children}</body></html>;}
