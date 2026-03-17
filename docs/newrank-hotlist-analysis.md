NewRank 热榜爆文分析（JS 版）
==============================

重要说明
- 依赖文件（如 Playwright / xlsx 等）不提交到仓库，请在本地环境安装依赖后运行脚本。
- 使用前请确保已有 cookies.json，且路径正确。
==============================

本仓库提供一个基于 Node.js 的实现，用于自动化从新榜（NewRank）导出当天的爆文数据，并对数据进行分析，产出可落地的洞察。

核心思路与原理
- 登录态管理：使用 cookies.json 中的 Cookie，通过 Playwright 注入浏览器上下文实现已登录状态，访问热榜页 https://a.newrank.cn/trade/media/hotList。
- 数据导出：在热榜页中自动定位并触发“导出数据”，将当天的前50篇爆文导出为 Excel/CSV 文件，下载保存到本地。
- 数据读取与分析：使用 xlsx 读取导出的表格数据，完成以下分析：
  - TOP10：按爆文指数排序，选取前10条。
  - 内容类型占比：统计各内容类型的百分比。
  - 标题规律：对标题进行简单分词统计，提取高频词汇。
  - 标题公式：基于高频词和数字的组合模板，给出常见的标题写法模板。
  - 选题建议：结合情感、倾听、陪伴、聊天、搭子等方向给出可能的选题方向。
- 输出格式：分析结果以 JSON 保存，方便后续再利用或生成报表。

核心文件与说明
- scripts/analyze_newrank_hotlist.js：Node.js 版实现主入口，完成导出、解析、分析、输出。
- scripts/package.json：用于安装依赖及执行分析脚本的简化入口。
- downloads/：脚本会在此目录保存当天导出的 Excel 文件。

运行前提与依赖
- Node.js 版本：推荐 18+。
- 依赖：Playwright、xlsx。安装方式在 scripts/ 目录下的 README 中有详细步骤。
- cookies.json：需要包含列如 name、value、domain、path、httpOnly、secure 等字段，脚本对格式进行了容错处理。

快速上手（JS 版）
1) 在仓库根目录执行：
   - cd scripts
   - npm install
2) 准备 cookies.json，路径通过 --cookies 指定，例如：
   node analyze_newrank_hotlist.js --cookies "/path/to/cookies.json" --output "/path/to/results.json"
3) 结果输出：
   - 结果 JSON 文件：你在 --output 指定的位置
   - 下载的导出文件：downloads/hotlist_YYYYMMDD.xlsx

注意与扩展
- 导出按钮定位：若页面文本或按钮定位发生变化，请提供截图或新文本，我可快速更新选择器。
- 未来可以扩展：输出到 Excel/CSV、自动推送分析摘要到聊天工具、或将分析作为定时任务执行。

维护与变更
- 初版本实现：2026-03-17
- 后续变更将记录在提交信息和此文档中。
