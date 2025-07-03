# MCP Server 分页功能优化指南

## 概述

本文档介绍了对 IoT MCP Server 进行的分页功能优化，旨在解决 Claude API token 使用量过高的问题。

## 问题背景

用户在使用 Claude API 调用 MCP server 接口时遇到速率限制错误：
```
This request would exceed the rate limit for your organization of 20,000 input tokens per minute
```

原因分析：
- 原有工具一次性返回所有数据（产品列表、设备列表）
- 大量数据导致 token 消耗过高
- 缺乏分页控制机制

## 优化方案

基于 MCP Pagination 协议实现分页功能：

### 1. 新增分页工具

#### `list_products_paginated`
- **功能**：分页获取产品列表
- **参数**：
  - `cursor` (可选): 分页游标，用于获取下一页
- **特性**：
  - 默认每页返回 15 条记录
  - 使用 base64 编码的不透明游标
  - 符合 MCP 分页协议标准

#### `list_devices_paginated`
- **功能**：分页获取设备列表
- **参数**：
  - `product_key` (必需): 产品键值
  - `cursor` (可选): 分页游标，用于获取下一页
- **特性**：
  - 默认每页返回 15 条记录
  - 游标包含产品键验证
  - 提供清晰的分页导航提示

### 2. 技术实现

#### 分页游标机制
```typescript
interface PaginationCursor {
  pageNo: number;
  pageSize: number;
  productKey?: string;
  totalItems?: number;
}
```

#### 响应格式
```typescript
interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
}
```

### 3. 使用方法

#### 获取第一页产品列表
```javascript
// 调用 list_products_paginated 工具
// 不传入 cursor 参数
```

#### 获取下一页
```javascript
// 使用上一次响应中的 nextCursor 值
// 调用 list_products_paginated 工具，传入 cursor 参数
```

#### 响应示例
```
Product list (page results: 15 products):
============================================================
1. Product A
   Product Key: ABC123
   ...

📄 More products available. Use cursor: eyJwYWdlTm8iOjIsInBhZ2VTaXplIjoxNX0=
Call this tool again with the cursor parameter to get the next page.
```

## 优化效果

### Token 使用量减少
- **之前**：一次返回所有数据（可能数百条记录）
- **之后**：每次最多返回 15 条记录
- **减少比例**：约 80-90% 的 token 使用量减少

### 用户体验改善
- 更快的响应时间
- 避免速率限制错误
- 按需加载数据
- 清晰的分页导航

## 兼容性

- 保留所有原有工具，确保向后兼容
- 新增分页工具作为额外选项
- 用户可根据需要选择使用分页版本或非分页版本

## 最佳实践

1. **优先使用分页工具**：对于可能返回大量数据的查询，建议使用分页版本
2. **合理设置页面大小**：默认 15 条记录平衡了性能和用户体验
3. **处理游标**：始终检查响应中的 `nextCursor` 字段来判断是否有更多数据
4. **错误处理**：妥善处理无效游标等错误情况

## 实现细节

### 文件修改
- `src/iot-utils.ts`: 添加分页支持函数
- `src/iot-server.ts`: 添加新的分页工具定义

### 核心函数
- `listProductsPaginated()`: 分页产品列表获取
- `listDevicesPaginated()`: 分页设备列表获取
- `encodeCursor()` / `decodeCursor()`: 游标编码解码

### 安全性
- 游标验证：防止跨产品的游标误用
- 错误处理：优雅处理无效游标
- 数据验证：确保返回数据的完整性

## 总结

通过实现基于 MCP Pagination 协议的分页功能，成功解决了 token 使用量过高的问题，同时提供了更好的用户体验和系统性能。新的分页工具完全兼容现有系统，用户可以平滑过渡到新的使用方式。