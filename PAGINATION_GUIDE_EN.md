# MCP Server Pagination Optimization Guide

## Overview

This document describes the pagination optimization implemented for the IoT MCP Server to address the issue of excessive Claude API token usage.

## Problem Background

Users encountered rate limit errors when calling MCP server interfaces via Claude API:
```
This request would exceed the rate limit for your organization of 20,000 input tokens per minute
```

Root cause analysis:
- Original tools returned all data at once (product lists, device lists)
- Large amounts of data resulted in excessive token consumption
- Lack of pagination control mechanisms

## Optimization Solution

Implemented pagination functionality based on the MCP Pagination protocol:

### 1. New Paginated Tools

#### `list_products_paginated`
- **Function**: Paginated retrieval of product lists
- **Parameters**:
  - `cursor` (optional): Pagination cursor for fetching the next page
- **Features**:
  - Returns 15 records per page by default
  - Uses base64-encoded opaque cursors
  - Complies with MCP pagination protocol standards

#### `list_devices_paginated`
- **Function**: Paginated retrieval of device lists
- **Parameters**:
  - `product_key` (required): Product key identifier
  - `cursor` (optional): Pagination cursor for fetching the next page
- **Features**:
  - Returns 15 records per page by default
  - Cursor includes product key validation
  - Provides clear pagination navigation hints

### 2. Technical Implementation

#### Pagination Cursor Mechanism
```typescript
interface PaginationCursor {
  pageNo: number;
  pageSize: number;
  productKey?: string;
  totalItems?: number;
}
```

#### Response Format
```typescript
interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
}
```

### 3. Usage Instructions

#### Fetch First Page of Products
```javascript
// Call list_products_paginated tool
// Do not pass cursor parameter
```

#### Fetch Next Page
```javascript
// Use the nextCursor value from the previous response
// Call list_products_paginated tool, passing the cursor parameter
```

#### Response Example
```
Product list (page results: 15 products):
============================================================
1. Product A
   Product Key: ABC123
   ...

📄 More products available. Use cursor: eyJwYWdlTm8iOjIsInBhZ2VTaXplIjoxNX0=
Call this tool again with the cursor parameter to get the next page.
```

## Optimization Results

### Token Usage Reduction
- **Before**: Returned all data at once (potentially hundreds of records)
- **After**: Maximum of 15 records per request
- **Reduction Rate**: Approximately 80-90% reduction in token usage

### User Experience Improvements
- Faster response times
- Avoids rate limit errors
- On-demand data loading
- Clear pagination navigation

## Compatibility

- Preserves all existing tools, ensuring backward compatibility
- New paginated tools provided as additional options
- Users can choose between paginated and non-paginated versions as needed

## Best Practices

1. **Prioritize paginated tools**: For queries that may return large amounts of data, recommend using paginated versions
2. **Reasonable page size**: Default of 15 records balances performance and user experience
3. **Handle cursors**: Always check the `nextCursor` field in responses to determine if more data is available
4. **Error handling**: Properly handle invalid cursors and other error conditions

## Implementation Details

### File Modifications
- `src/iot-utils.ts`: Added pagination support functions
- `src/iot-server.ts`: Added new paginated tool definitions

### Core Functions
- `listProductsPaginated()`: Paginated product list retrieval
- `listDevicesPaginated()`: Paginated device list retrieval
- `encodeCursor()` / `decodeCursor()`: Cursor encoding/decoding

### Security
- Cursor validation: Prevents cross-product cursor misuse
- Error handling: Gracefully handles invalid cursors
- Data validation: Ensures integrity of returned data

## Summary

By implementing pagination functionality based on the MCP Pagination protocol, we successfully resolved the excessive token usage issue while providing better user experience and system performance. The new paginated tools are fully compatible with the existing system, allowing users to smoothly transition to the new usage patterns.