import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/ticket.css'
import App from './App'
/*
 * effects.css 放在最后：它覆写的是 React Bits 组件的默认样式，
 * 而那些样式（如 StarBorder.css）是随组件 import 进来的，会排在前面几行之后。
 * 本文件里的选择器都用了双类（.star-border-container.pb-star-border）提权，
 * 即使打包器调整顺序也稳，这里保持「后引入」只是为了读起来符合直觉。
 */
import './styles/effects.css'
import './styles/setup.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
