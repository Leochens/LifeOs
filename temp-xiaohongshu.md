AI 干活时，你在摸鱼但浑然不觉...

不知道你们有没有这种感觉：给 Claude Code 派了个活，比如让它帮你改改代码、整理整理文件啥的。然后跑去刷视频、追剧，心里想"让它慢慢搞吧"。

结果根本不知道它啥时候完事的。

你以为还在跑呢，其实早就停在那儿了。

白等。

---

## 后来发现的宝藏功能

Claude Code 居然可以设置任务完成提醒！配置好之后，AI 干完会"叮"一声，在隔壁房间都能听见。

第一时间就能知道可以去继续下一步了，不用有事没事切回来看看。

对于经常开着 AI 干活然后跑去摸鱼的人来说，挺好用的。

---

## 原理解释：什么是 Hook？

Claude Code 有一个叫 **Hook** 的功能，简单来说就是"钩子"——可以在特定时机自动执行一些操作。

你可以理解成：
- 就像微信的"拍一拍"，当你做什么动作时，系统自动触发另一个动作
- Claude Code 提供了多种 Hook，比如：
  - `Stop`：每次 Claude 停止运行时触发（比如思考完毕、生成中断）
  - `TaskCompleted`：任务标记完成时触发
  - `Notification`：收到特定通知时触发（比如权限询问）

我们就是利用这些钩子，在不同时机自动运行播放音效的脚本，从而提醒你。

---

## 完整配置教程

### macOS 版

**第一步：创建音效脚本**

在终端依次执行：

```bash
mkdir -p ~/.claude

# 任务完成音效（清脆玻璃声）
cat > ~/.claude/play-complete.sh << 'EOF'
#!/bin/bash
afplay /System/Library/Sounds/Glass.aiff
EOF

# 停止运行音效（低音提示）
cat > ~/.claude/play-stop.sh << 'EOF'
#!/bin/bash
afplay /System/Library/Sounds/Basso.aiff
EOF

# 询问用户音效（弹出声）
cat > ~/.claude/play-ask.sh << 'EOF'
#!/bin/bash
afplay /System/Library/Sounds/Pop.aiff
EOF

chmod +x ~/.claude/play-complete.sh ~/.claude/play-stop.sh ~/.claude/play-ask.sh
```

**第二步：修改配置文件**

打开 `~/.claude/settings.json`，在最外层大括号里加上：

```json
"hooks": {
  "TaskCompleted": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "/Users/你的用户名/.claude/play-complete.sh"
        }
      ]
    }
  ],
  "Stop": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "/Users/你的用户名/.claude/play-stop.sh"
        }
      ]
    }
  ],
  "Notification": [
    {
      "matcher": "permission_prompt",
      "hooks": [
        {
          "type": "command",
          "command": "/Users/你的用户名/.claude/play-ask.sh"
        }
      ]
    }
  ]
}
```

**注意**：把"你的用户名"换成你电脑实际的用户名。

**第三步：测试**

```bash
~/.claude/play-complete.sh  # 任务完成
~/.claude/play-stop.sh      # 停止运行
~/.claude/play-ask.sh       # 询问用户
```

分别能听到三种不同的声音就成功了。

---

### Windows 版

**第一步：创建音效脚本**

在 `C:\Users\你的用户名\.claude\` 目录下创建三个 bat 文件：

`play-complete.bat`（任务完成）：
```bat
@echo off
powershell -c "Add-Type -AssemblyName System.Windows.Forms; [System.Media.SystemSounds]::Exclamation.Play()"
```

`play-stop.bat`（停止运行）：
```bat
@echo off
powershell -c "Add-Type -AssemblyName System.Windows.Forms; [System.Media.SystemSounds]::Hand.Play()"
```

`play-ask.bat`（询问用户）：
```bat
@echo off
powershell -c "Add-Type -AssemblyName System.Windows.Forms; [System.Media.SystemSounds]::Question.Play()"
```

**第二步：修改配置文件**

打开 `C:\Users\你的用户名\.claude\settings.json`，加上：

```json
"hooks": {
  "TaskCompleted": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "C:\\Users\\你的用户名\\.claude\\play-complete.bat"
        }
      ]
    }
  ],
  "Stop": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "C:\\Users\\你的用户名\\.claude\\play-stop.bat"
        }
      ]
    }
  ],
  "Notification": [
    {
      "matcher": "permission_prompt",
      "hooks": [
        {
          "type": "command",
          "command": "C:\\Users\\你的用户名\\.claude\\play-ask.bat"
        }
      ]
    }
  ]
}
```

**第三步：测试**

分别运行这三个 bat 文件，能听到不同的提示音就成功了。

---

## 三种音效的含义

| 场景 | 音效 | 含义 |
|------|------|------|
| 任务完成 | 玻璃声（Glass） | AI 干完活了，快来看看结果 |
| 停止运行 | 低音（Basso） | AI 暂停了，可能在等你回复 |
| 询问用户 | 弹出声（Pop） | AI 在等你确认权限或输入 |

---

## 进阶：自定义音效

**macOS** 可以换这些系统音效：
- `/System/Library/Sounds/Glass.aiff` - 清脆玻璃声
- `/System/Library/Sounds/Pop.aiff` - 弹出声
- `/System/Library/Sounds/Basso.aiff` - 低音提示
- `/System/Library/Sounds/Submarine.aiff` - 完成音
- `/System/Library/Sounds/Funk.aiff` - 有趣的声音

**Windows** 可以用 PowerShell 播放不同系统声音：
- `Exclamation` - 感叹声
- `Hand` - 停止/错误提示音
- `Question` - 询问提示音
- `Asterisk` - 信息提示音

---

从此 AI 的各种状态你都能第一时间知道，再也不用傻傻等待了。

#效率神器 #AI工具 #Claude Code #打工人日常 #时间管理 #macOS #Windows
