# NewRank 热榜爆文分析 (JS 版)

本仓库实现了一个基于 Node.js 的脚本，用于从 NewRank 的热榜导出当天的爆文数据，并对数据进行分析，包括 TOP10、内容类型占比、标题规律与选题建议等。请注意，依赖需要在本地安装，仓库中不提交依赖文件。

核心思想
- 使用 cookies.json 中的 Cookie，通过 Playwright 注入浏览器上下文实现已登录状态，访问热榜页 https://a.newrank.cn/trade/media/hotList。
- 自动触发导出操作，下载当天的爆文数据（Excel/CSV），并保存在本地 downloads 目录。
- 读取导出的数据，完成以下分析：
  1) TOP10：按爆文指数排序，取前10条
  2) 内容类型占比：统计不同类型所占比重
  3) 标题规律：简单的分词统计，提取高频词
  4) 标题公式：基于高频词和数字的模板建议
  5) 选题建议：聚焦树洞、倾听、陪伴、聊天、搭子等方向
- 输出结果为 JSON，便于二次加工或自动化报表

文件与目录概览
- README.md: 本文件，包含原理与使用要点
- docs/newrank-hotlist-analysis.md: 原理与使用说明的扩展文档
- scripts/analyze_newrank_hotlist.js: Node.js 实现主入口
- scripts/README.md: JS 版使用说明（可帮助新同事快速上手）
- downloads/: 导出的热榜数据下载保存目录
- .gitignore: 忽略依赖、下载产物等

使用前提
- 已在本地安装 Node.js（推荐 18+）
- cookies.json 文件准备就绪，包含 cookie 的基础字段（name/value/domain/path/httpOnly/secure 等），脚本对字段进行了容错处理
- 依赖仅在本地安装，仓库不提交依赖

快速开始
1) 安装依赖
   cd scripts
   npm install

2) 运行分析
   node analyze_newrank_hotlist.js --cookies "/path/to/cookies.json" --output "/path/to/results.json"

3) 查看结果
- 输出 JSON 文件：你在 --output 指定的位置
- 导出的热榜数据：downloads/ 目录中，命名为 hotlist_YYYYMMDD.xlsx

文件说明与结构
- downloads/：导出数据文件（Excel）保存目录
- scripts/analyze_newrank_hotlist.js：核心实现（浏览器自动化 + 数据分析）
- docs/newrank-hotlist-analysis.md：原理与使用说明的扩展文档
- .gitignore：本仓库将忽略 dependencies、下载产物等

注意事项
- 依赖只在本地安装，不提交依赖清单；请确保本地网络可访问并且 Playwright 能下载浏览器资源。
- 如果页面文本或按钮文本发生变化（例如“导出数据”按钮），请提供截图或新文本，我可以快速更新定位逻辑。
- cookies.json 的域名要覆盖目标域，例如 a.newrank.cn、trade 等。

后续可以做的改进
- 将输出扩展为 Excel/CSV 模板，方便汇报。
- 集成定时任务（如 GitHub Actions 或本地 cron），每日自动抓取并汇总分析。
- 提供一个简短的 PR 描述模板，方便你向远端仓库提交变更。

如需我进一步整理成一键化脚手架（含 Docker/CI 示例、更多导出格式等），告诉我你的偏好即可。
