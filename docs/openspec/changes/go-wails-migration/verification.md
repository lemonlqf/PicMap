# 验证记录：go-wails-migration

## 基线审计（Task 1，日期：2026-08-13）

| 检查项 | 命令 | 结果 |
|---|---|---|
| Go 编译 | go build ./... | PASS（退出码 0） |
| Go vet | go vet ./... | PASS（退出码 0） |
| 前端类型检查 | npx vue-tsc --noEmit --skipLibCheck | 153 个错误均为预存错误（LocateDialog/VueCropper/ImageUpload 等），本次变更涉及文件（imgUpload/Index.vue、utils/Image.ts、wails/api.ts、eventBus.ts、type/image.ts）零错误 |
| P1.4 app.go 绑定 | Select-String app.go 'SelectImages\|ImportImages' | 有匹配（app.go:64-70） |
| P1.2 ImportFile 模型 | Select-String result.go 'ImportFile\|SelectedImage' | 有匹配（result.go:42-59） |
| P1.3 ImportImages handler | Select-String internal/ 'ImportImages' | 有匹配（handler.go） |
| P2.1 api.ts 路径上传方法 | Select-String api.ts 'selectImages\|importImages' | 有匹配（api.ts:28-46） |
| P2.2 Index.vue 旧逻辑残留 | Select-String Index.vue 'el-upload\|ExifReader\|readFileAsDataURL' | 无代码引用（仅遗留 `:deep(.el-upload-list)` 死样式，不影响功能） |

## 决策门结论

路径上传（P1.1-P1.4 / P2.1-P2.4）落地状态：**已落地**（git stash "1111" 恢复后，SelectImages/ImportImages 后端绑定、前端 api.ts/Index.vue/Image.ts 改造均在工作区）。

对后续任务的影响：Task 8（P3.4-P3.6 手工验证）可以正常执行，不做 BLOCKED 处置。tasks.md 的 P1.x/P2.x 勾选状态与实际代码一致，无需修正。

## T5.4 axios 清理（Task 2，日期：2026-08-13）

- package.json / package-lock.json / src 引用：均已无 axios（仅 api.ts 一处陈旧注释，已清理）
- node_modules/axios：不存在
- 技术债：exif-js、exifreader、heic2any 依赖仍保留——旧上传链路（el-upload）已移除，路径上传（P1/P2）落地后这些依赖为死依赖，待后续清理
