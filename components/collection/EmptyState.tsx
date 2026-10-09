import {Box} from 'lucide-react';

export default function EmptyState({add}:{add:()=>void}){
  return <div className="empty"><Box size={36}/><h2>展厅，等待第一个故事。</h2><button className="primary-button" onClick={add}>添加第一件藏品</button></div>;
}
