## 坦克大战 · Tank Battle (Web)

一个基于 HTML5 Canvas 的轻量坦克射击游戏，支持键鼠与移动端触控，包含敌人种类、道具、主题切换、粒子特效与本地排行榜。

### 演示截图 / GIF

![主界面与HUD](assets/screenshot-1.png)
![战斗与爆炸粒子](assets/screenshot-2.png)
![星际主题](assets/screenshot-3.png)
![移动端触控](assets/screenshot-4.png)

GIF 演示：

![游戏演示](ezgif-7b2e427b4c8b69.gif)

捕捉建议：
- Windows: Win+G 打开 Xbox Game Bar 录屏，输出 MP4；或使用 OBS。
- macOS: Shift+Cmd+5 系统录屏；或使用 OBS。
- 录制后用 ffmpeg 生成高质量 GIF：

```bash
ffmpeg -i input.mp4 -vf "fps=30,scale=960:-1:flags=lanczos" -t 10 -y assets/demo.gif
```

或使用 ImageMagick 优化：

```bash
ffmpeg -i input.mp4 -vf "fps=20,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=new=1" -y assets/demo.gif
```

### 玩法
- 控制坦克移动射击，击毁来袭敌人。
- 敌人按波次生成，难度逐步提升。
- 波次间可能生成道具：拾取可治疗或提升射速（限时）。
- 生命归零后游戏结束，自动记录最高分与最佳波次。

### 操作
- 键盘：W/A/S/D 或 方向键 移动；P/Esc 暂停。
- 鼠标：指向瞄准，左键射击。
- 触控：左下虚拟摇杆移动，右下按钮射击。

### 特性
- 主题：草原 / 星际，可在 HUD 按钮切换。
- 敌人：
  - 侦察（快、低血量）
  - 重装（慢、高血量）
  - 狙击（中速、远射程）
- 道具：
  - 治疗（+1 生命，上限不超最大生命）
  - 急射（短时间内降低射击冷却）
- 画面与音效：网格/星空背景、墙体障碍、爆炸粒子、基础 WebAudio 音效。
- 排行：`localStorage` 保存最高分与最佳波次。

### 运行
- 直接双击根目录 `index.html` 即可游玩。
- 或使用本地静态服务器（推荐移动端调试）：
  - Node: `npx http-server . -p 5173` 后访问 `http://localhost:5173`。

### 目录
```
web1/
├─ index.html
├─ styles.css
└─ src/
   └─ game.js
```

### 扩展建议
- 新主题：在 `THEMES` 增加配色并在 HUD 接入。
- 新敌人：在 `ENEMY.variants` 定义速度/血量/射速/颜色与特殊行为。
- 新道具：在 `POWERUPS` 注册并实现拾取与时效逻辑。
- 关卡：在 `spawnWave` 调整波次节奏，加入 Boss/目标/计时等模式。
- 体验：炮口火焰、拖尾、更多音效、触控双摇杆（独立瞄准）。

### 许可证
MIT License（示例代码，便于学习与二次开发）。


