# PicMap API 鎺ュ彛鏂囨。

## 姒傝堪

PicMap 鏄竴涓浘鐗囨爣娉ㄤ笌绠＄悊骞冲彴鐨勫悗绔?API 鏈嶅姟锛屾彁渚涚敤鎴风鐞嗐€佸浘鐗囦笂浼犱笅杞姐€佽建杩圭鐞嗐€佹暟鎹浠界瓑鍔熻兘銆?

**Base URL**: `http://localhost:3000`

---

## 閫氱敤璇存槑

### 鍝嶅簲鏍煎紡

鎵€鏈夋帴鍙ｅ搷搴斿潎閲囩敤缁熶竴 JSON 鏍煎紡锛?

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": {},
  "time": 1704067200000
}
```

### 鐘舵€佺爜璇存槑

| code  | 璇存槑           |
|-------|----------------|
| 200   | 鎴愬姛           |
| 400   | 鍙傛暟鏍￠獙澶辫触   |
| 404   | 鎺ュ彛涓嶅瓨鍦?    |
| 429   | 鎿嶄綔杩囦簬棰戠箒   |
| 500   | 鏈嶅姟鍣ㄥ唴閮ㄩ敊璇?|

---

## 鐩綍

- [鐢ㄦ埛绠＄悊鎺ュ彛](#鐢ㄦ埛绠＄悊鎺ュ彛)
- [鍥剧墖鎺ュ彛](#鍥剧墖鎺ュ彛)
- [Schema 鎺ュ彛](#schema-鎺ュ彛)
- [搴旂敤閰嶇疆鎺ュ彛](#搴旂敤閰嶇疆鎺ュ彛)
- [杞ㄨ抗鎺ュ彛](#杞ㄨ抗鎺ュ彛)
- [澶囦唤鎺ュ彛](#澶囦唤鎺ュ彛)

---

## 鐢ㄦ埛绠＄悊鎺ュ彛

### 鍒涘缓鐢ㄦ埛鐩綍

鍒涘缓鐢ㄦ埛鐨勭洰褰曞拰鏁版嵁缁撴瀯銆?

**璇锋眰鍦板潃**: `POST /user/createUser`

**璇锋眰鍙傛暟**:

| 鍙傛暟鍚?  | 绫诲瀷   | 蹇呭～ | 璇存槑     |
|----------|--------|------|----------|
| userId   | string | 鏄?  | 鐢ㄦ埛ID   |

**璇锋眰绀轰緥**:

```json
{
  "userId": "user123"
}
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": "鍒涘缓鎴愬姛",
  "time": 1704067200000
}
```

---

### 鍒犻櫎鐢ㄦ埛鐩綍

鍒犻櫎鎸囧畾鐢ㄦ埛鐨勭洰褰曞強鎵€鏈夋暟鎹€?

**璇锋眰鍦板潃**: `POST /user/deleteUser`

**璇锋眰鍙傛暟**:

| 鍙傛暟鍚?       | 绫诲瀷   | 蹇呭～ | 璇存槑     |
|---------------|--------|------|----------|
| userId        | string | 鍚?  | 鐢ㄦ埛ID   |
| currentUserId | string | 鍚?  | 褰撳墠鐢ㄦ埛ID |

**璇锋眰绀轰緥**:

```json
{
  "userId": "user123",
  "currentUserId": "admin"
}
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": "鍒犻櫎鎴愬姛",
  "time": 1704067200000
}
```

---

### 鑾峰彇鐢ㄦ埛鍒楄〃

鑾峰彇鎵€鏈夌敤鎴风殑鍩烘湰淇℃伅銆?

**璇锋眰鍦板潃**: `GET /user/`

**璇锋眰绀轰緥**:

```
GET /user/
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": "respond with a resource",
  "time": 1704067200000
}
```

---

## 鍥剧墖鎺ュ彛

### 鍥剧墖鏍煎紡杞崲

灏?HEIC/HEIF/RAW 绛夋牸寮忚浆鎹负 JPEG銆?

**璇锋眰鍦板潃**: `POST /image/getJPGImage`

**璇锋眰鍙傛暟**: FormData

| 鍙傛暟鍚?| 绫诲瀷 | 蹇呭～ | 璇存槑   |
|--------|------|------|--------|
| file   | file | 鏄?  | 鍥剧墖鏂囦欢 |

**鍝嶅簲**: JPEG 鏍煎紡鐨勫浘鐗囦簩杩涘埗鏁版嵁

---

### 涓婁紶鍥剧墖

鎵归噺涓婁紶鍥剧墖鍒版湇鍔″櫒銆?

**璇锋眰鍦板潃**: `POST /image/uploadImages`

**璇锋眰鍙傛暟**:

| 鍙傛暟鍚?       | 绫诲瀷   | 蹇呭～ | 璇存槑         |
|---------------|--------|------|--------------|
| currentUserId | string | 鏄?  | 褰撳墠鐢ㄦ埛ID   |
| images        | array  | 鏄?  | 鍥剧墖鏁扮粍     |

**images 鏁扮粍椤圭粨鏋?*:

| 鍙傛暟鍚?        | 绫诲瀷   | 璇存槑           |
|----------------|--------|----------------|
| id             | string | 鍥剧墖鍞竴鏍囪瘑   |
| name           | string | 鍥剧墖鍚嶇О       |
| url            | string | Base64 鍥剧墖鏁版嵁|
| thumbnailUrl   | string | 缂╃暐鍥?Base64)|

**璇锋眰绀轰緥**:

```json
{
  "currentUserId": "user123",
  "images": [
    {
      "id": "img_001",
      "name": "photo1.jpg",
      "url": "data:image/jpeg;base64,...",
      "thumbnailUrl": "data:image/jpeg;base64,..."
    }
  ]
}
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": "涓婁紶鎴愬姛",
  "time": 1704067200000
}
```

---

### 鑾峰彇缂╃暐鍥?

鏍规嵁鍥剧墖ID鑾峰彇鎸囧畾鍥剧墖鐨勭缉鐣ュ浘銆?

**璇锋眰鍦板潃**: `POST /image/getSmallImage`

**璇锋眰鍙傛暟**:

| 鍙傛暟鍚?       | 绫诲瀷   | 蹇呭～ | 璇存槑     |
|---------------|--------|------|----------|
| imageId       | string | 鏄?  | 鍥剧墖ID   |
| currentUserId | string | 鏄?  | 褰撳墠鐢ㄦ埛ID |

**璇锋眰绀轰緥**:

```json
{
  "imageId": "img_001",
  "currentUserId": "user123"
}
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": {
    "file": "data:image/jpeg;base64,..."
  },
  "time": 1704067200000
}
```

---

### 鎵归噺鑾峰彇缂╃暐鍥?

鎵归噺鑾峰彇澶氬紶鍥剧墖鐨勭缉鐣ュ浘銆?

**璇锋眰鍦板潃**: `POST /image/getSmallImages`

**璇锋眰鍙傛暟**:

| 鍙傛暟鍚?       | 绫诲瀷   | 蹇呭～ | 璇存槑       |
|---------------|--------|------|------------|
| imageIds      | array  | 鏄?  | 鍥剧墖ID鏁扮粍 |
| currentUserId | string | 鏄?  | 褰撳墠鐢ㄦ埛ID |

**璇锋眰绀轰緥**:

```json
{
  "imageIds": ["img_001", "img_002", "img_003"],
  "currentUserId": "user123"
}
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": {
    "files": [
      "data:image/jpeg;base64,...",
      "data:image/jpeg;base64,...",
      "data:image/jpeg;base64,..."
    ]
  },
  "time": 1704067200000
}
```

---

### 鑾峰彇鍘熷浘

鏍规嵁鍥剧墖ID鑾峰彇鍘熷鍥剧墖銆?

**璇锋眰鍦板潃**: `POST /image/getFullImage`

**璇锋眰鍙傛暟**:

| 鍙傛暟鍚?       | 绫诲瀷   | 蹇呭～ | 璇存槑     |
|---------------|--------|------|----------|
| imageId       | string | 鏄?  | 鍥剧墖ID   |
| currentUserId | string | 鏄?  | 褰撳墠鐢ㄦ埛ID |

**璇锋眰绀轰緥**:

```json
{
  "imageId": "img_001",
  "currentUserId": "user123"
}
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": {
    "file": "data:image/jpeg;base64,..."
  },
  "time": 1704067200000
}
```

---

### 鍒犻櫎鍥剧墖

鎵归噺鍒犻櫎鎸囧畾鍥剧墖鍙婂叾缂╃暐鍥俱€?

**璇锋眰鍦板潃**: `POST /image/deleteImages`

**璇锋眰鍙傛暟**:

| 鍙傛暟鍚?       | 绫诲瀷   | 蹇呭～ | 璇存槑         |
|---------------|--------|------|--------------|
| deleteImages  | array  | 鏄?  | 瑕佸垹闄ょ殑鍥剧墖ID鏁扮粍 |
| currentUserId | string | 鏄?  | 褰撳墠鐢ㄦ埛ID   |

**璇锋眰绀轰緥**:

```json
{
  "deleteImages": ["img_001", "img_002"],
  "currentUserId": "user123"
}
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": "鍥剧墖鍒犻櫎鎴愬姛锛?,
  "time": 1704067200000
}
```

---

### 鏇存柊鍥剧墖淇℃伅

鏇存柊鍥剧墖鐨勫厓鏁版嵁淇℃伅銆?

**璇锋眰鍦板潃**: `POST /image/updateImages`

> 鎺ュ彛寮€鍙戜腑锛屾殏涓嶅彲鐢?

---

### 涓嬭浇鍥剧墖

涓嬭浇鎸囧畾鍥剧墖銆?

**璇锋眰鍦板潃**: `POST /image/downloadImage`

**璇锋眰鍙傛暟**:

| 鍙傛暟鍚?       | 绫诲瀷   | 蹇呭～ | 璇存槑     |
|---------------|--------|------|----------|
| imageId       | string | 鏄?  | 鍥剧墖ID   |
| currentUserId | string | 鏄?  | 褰撳墠鐢ㄦ埛ID |

**璇锋眰绀轰緥**:

```json
{
  "imageId": "img_001",
  "currentUserId": "user123"
}
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": {
    "file": "data:image/jpeg;base64,..."
  },
  "time": 1704067200000
}
```

---

## Schema 鎺ュ彛

### 鑾峰彇 Schema

鑾峰彇鐢ㄦ埛鐨勬墍鏈夊浘鐗囨爣娉ㄦ暟鎹紙Marker銆佸垎缁勩€佽建杩圭瓑淇℃伅锛夈€?

**璇锋眰鍦板潃**: `GET /schema/getSchema`

**Query 鍙傛暟**:

| 鍙傛暟鍚?       | 绫诲瀷   | 蹇呭～ | 璇存槑     |
|---------------|--------|------|----------|
| currentUserId | string | 鏄?  | 褰撳墠鐢ㄦ埛ID |

**璇锋眰绀轰緥**:

```
GET /schema/getSchema?currentUserId=user123
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": "{\"version\":\"1.0.0\",\"mapInfo\":{...},\"groupInfo\":[],\"imageInfo\":[],\"trackInfo\":[]}",
  "time": 1704067200000
}
```

> 娉ㄦ剰: 杩斿洖鐨?data 瀛楁涓?JSON 瀛楃涓诧紝闇€瑕?JSON.parse() 瑙ｆ瀽

---

### 淇濆瓨 Schema

淇濆瓨鐢ㄦ埛鐨勫浘鐗囨爣娉ㄦ暟鎹€?

**璇锋眰鍦板潃**: `POST /schema/setSchema`

**璇锋眰鍙傛暟**:

| 鍙傛暟鍚?       | 绫诲瀷   | 蹇呭～ | 璇存槑     |
|---------------|--------|------|----------|
| currentUserId | string | 鏄?  | 褰撳墠鐢ㄦ埛ID |
| schema        | string | 鏄?  | Schema 鏁版嵁 (JSON瀛楃涓? |

**璇锋眰绀轰緥**:

```json
{
  "currentUserId": "user123",
  "schema": "{\"version\":\"1.0.0\",\"mapInfo\":{...},\"groupInfo\":[],\"imageInfo\":[]}"
}
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": "schema鏁版嵁鏇存柊鎴愬姛锛?,
  "time": 1704067200000
}
```

---

## 搴旂敤閰嶇疆鎺ュ彛

### 鑾峰彇鐢ㄦ埛鍒楄〃

鑾峰彇鎵€鏈夌敤鎴风殑鍩烘湰淇℃伅銆?

**璇锋眰鍦板潃**: `GET /appSchema/getUserInfos`

**璇锋眰绀轰緥**:

```
GET /appSchema/getUserInfos
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": [
    {
      "userId": "user123",
      "userName": "寮犱笁",
      "createTime": "2025-01-01T00:00:00.000Z"
    }
  ],
  "time": 1704067200000
}
```

---

### 鑾峰彇搴旂敤閰嶇疆

鑾峰彇搴旂敤鐨勫叏灞€閰嶇疆淇℃伅銆?

**璇锋眰鍦板潃**: `GET /appSchema/getSchema`

**璇锋眰绀轰緥**:

```
GET /appSchema/getSchema
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": {
    "version": "1.0.0",
    "userInfos": [...],
    "mapInfo": {
      "mapTiles": [...],
      "defaultTileId": "tile_default1"
    }
  },
  "time": 1704067200000
}
```

---

### 淇濆瓨搴旂敤閰嶇疆

淇濆瓨搴旂敤鐨勫叏灞€閰嶇疆淇℃伅銆?

**璇锋眰鍦板潃**: `POST /appSchema/setSchema`

**璇锋眰鍙傛暟**:

| 鍙傛暟鍚?| 绫诲瀷   | 蹇呭～ | 璇存槑           |
|--------|--------|------|----------------|
| schema | object | 鏄?  | 搴旂敤閰嶇疆鏁版嵁   |

**璇锋眰绀轰緥**:

```json
{
  "schema": {
    "version": "1.0.0",
    "userInfos": [...],
    "mapInfo": {
      "mapTiles": [...],
      "defaultTileId": "tile_default1"
    }
  }
}
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": "appSchema鏁版嵁鏇存柊鎴愬姛锛?,
  "time": 1704067200000
}
```

---

## 杞ㄨ抗鎺ュ彛

### 涓婁紶杞ㄨ抗

涓婁紶 GPX 杞ㄨ抗鏂囦欢銆?

**璇锋眰鍦板潃**: `POST /track/uploadTrack`

**璇锋眰鍙傛暟**: FormData

| 鍙傛暟鍚?       | 绫诲瀷   | 蹇呭～ | 璇存槑     |
|---------------|--------|------|----------|
| file          | file   | 鏄?  | GPX 杞ㄨ抗鏂囦欢 |
| currentUserId | string | 鏄?  | 褰撳墠鐢ㄦ埛ID |

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": {
    "filePath": "D:/PicMap/user123/tracks/track_123456.gpx",
    "fileName": "track_123456.gpx"
  },
  "time": 1704067200000
}
```

---

### 鍒犻櫎杞ㄨ抗

鍒犻櫎鎸囧畾鐨勮建杩规枃浠躲€?

**璇锋眰鍦板潃**: `DELETE /track/deleteTrack`

**Query 鍙傛暟**:

| 鍙傛暟鍚?       | 绫诲瀷   | 蹇呭～ | 璇存槑     |
|---------------|--------|------|----------|
| fileName      | string | 鏄?  | 杞ㄨ抗鏂囦欢鍚?(鍘熷鍚嶏紝涓嶅甫鍓嶇紑) |
| currentUserId | string | 鏄?  | 褰撳墠鐢ㄦ埛ID |

**璇锋眰绀轰緥**:

```
DELETE /track/deleteTrack?fileName=璺戞.gpx&currentUserId=user123
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": {
    "message": "鍒犻櫎鎴愬姛"
  },
  "time": 1704067200000
}
```

---

### 鑾峰彇杞ㄨ抗

鑾峰彇鎸囧畾杞ㄨ抗鏂囦欢鐨勫唴瀹广€?

**璇锋眰鍦板潃**: `GET /track/getTrack`

**Query 鍙傛暟**:

| 鍙傛暟鍚?       | 绫诲瀷   | 蹇呭～ | 璇存槑     |
|---------------|--------|------|----------|
| fileName      | string | 鏄?  | 杞ㄨ抗鏂囦欢鍚?(鍘熷鍚嶏紝涓嶅甫鍓嶇紑) |
| currentUserId | string | 鏄?  | 褰撳墠鐢ㄦ埛ID |

**璇锋眰绀轰緥**:

```
GET /track/getTrack?fileName=璺戞.gpx&currentUserId=user123
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": {
    "fileContent": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><gpx>...</gpx>"
  },
  "time": 1704067200000
}
```

---

## 澶囦唤鎺ュ彛

### 鍒涘缓澶囦唤

灏嗘墍鏈夌敤鎴锋暟鎹墦鍖呮垚 ZIP 澶囦唤鏂囦欢銆?

**璇锋眰鍦板潃**: `POST /backup/backup`

**璇锋眰鍙傛暟**:

| 鍙傛暟鍚?| 绫诲瀷   | 蹇呭～ | 璇存槑           |
|--------|--------|------|----------------|
| name   | string | 鍚?  | 澶囦唤鏂囦欢鍚嶇О   |

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": {
    "filePath": "D:/PicMap_Backup/PicMap_Backup_2025-01-15T10-30-00.000Z.zip",
    "fileName": "PicMap_Backup_2025-01-15T10-30-00.000Z.zip",
    "size": 10485760
  },
  "time": 1704067200000
}
```

**杩斿洖瀛楁璇存槑**:

| 瀛楁鍚?  | 绫诲瀷   | 璇存槑             |
|----------|--------|------------------|
| filePath | string | 澶囦唤鏂囦欢瀹屾暣璺緞 |
| fileName | string | 澶囦唤鏂囦欢鍚?      |
| size     | number | 鏂囦欢澶у皬(瀛楄妭)   |

---

### 鑾峰彇澶囦唤鍒楄〃

鑾峰彇鎵€鏈夊凡鍒涘缓鐨勫浠芥枃浠跺垪琛ㄣ€?

**璇锋眰鍦板潃**: `GET /backup/backupList`

**璇锋眰绀轰緥**:

```
GET /backup/backupList
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": [
    {
      "fileName": "PicMap_Backup_2025-01-15T10-30-00.000Z.zip",
      "filePath": "D:/PicMap_Backup/PicMap_Backup_2025-01-15T10-30-00.000Z.zip",
      "size": 10485760,
      "createTime": "2025-01-15T10:30:00.000Z"
    }
  ],
  "time": 1704067200000
}
```

**杩斿洖瀛楁璇存槑**:

| 瀛楁鍚?    | 绫诲瀷   | 璇存槑           |
|------------|--------|----------------|
| fileName   | string | 澶囦唤鏂囦欢鍚?    |
| filePath   | string | 澶囦唤鏂囦欢璺緞   |
| size       | number | 鏂囦欢澶у皬(瀛楄妭) |
| createTime | string | 鍒涘缓鏃堕棿       |

---

### 瀵煎叆澶囦唤

浠庡浠芥枃浠舵仮澶嶆暟鎹€?

**璇锋眰鍦板潃**: `POST /backup/import`

**璇锋眰鍙傛暟**:

| 鍙傛暟鍚?  | 绫诲瀷   | 蹇呭～ | 璇存槑                          |
|----------|--------|------|-------------------------------|
| filePath | string | 鏄?  | 澶囦唤鏂囦欢璺緞                  |
| mode     | string | 鏄?  | 瀵煎叆妯″紡: `cover`(瑕嗙洊) 鎴?`merge`(鍚堝苟) |

**璇锋眰绀轰緥**:

```json
{
  "filePath": "D:/PicMap_Backup/PicMap_Backup_2025-01-15T10-30-00.000Z.zip",
  "mode": "merge"
}
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": "瀵煎叆鎴愬姛",
  "time": 1704067200000
}
```

**瀵煎叆妯″紡璇存槑**:

- `cover`: 瑕嗙洊妯″紡锛屽厛鍒犻櫎鐜版湁鎵€鏈夋暟鎹紝鍐嶅鍏ュ浠芥暟鎹?
- `merge`: 鍚堝苟妯″紡锛屼繚鐣欑幇鏈夋暟鎹紝灏嗗浠戒腑鐨勬柊鏁版嵁娣诲姞鍒扮幇鏈夋暟鎹腑

---

### 鍒犻櫎澶囦唤

鍒犻櫎鎸囧畾鐨勫浠芥枃浠躲€?

**璇锋眰鍦板潃**: `POST /backup/deleteBackup`

**璇锋眰鍙傛暟**:

| 鍙傛暟鍚?  | 绫诲瀷   | 蹇呭～ | 璇存槑         |
|----------|--------|------|--------------|
| filePath | string | 鏄?  | 澶囦唤鏂囦欢璺緞 |

**璇锋眰绀轰緥**:

```json
{
  "filePath": "D:/PicMap_Backup/PicMap_Backup_2025-01-15T10-30-00.000Z.zip"
}
```

**鍝嶅簲绀轰緥**:

```json
{
  "code": 200,
  "msg": "鎴愬姛",
  "data": "鍒犻櫎鎴愬姛",
  "time": 1704067200000
}
```

---

## 閿欒鐮佽缁嗚鏄?

| 閿欒鐮?| 鎻忚堪                     | 鍙兘鍘熷洜                           |
|--------|--------------------------|------------------------------------|
| 200    | 鎴愬姛                     | -                                  |
| 400    | 鍙傛暟鏍￠獙澶辫触             | 缂哄皯蹇呭～鍙傛暟鎴栧弬鏁版牸寮忎笉姝ｇ‘       |
| 404    | 鎺ュ彛涓嶅瓨鍦?              | 璇锋眰璺緞閿欒                       |
| 429    | 鎿嶄綔杩囦簬棰戠箒             | 璇锋眰棰戠巼瓒呰繃闄愬埗                   |
| 500    | 澶辫触                     | 鏈嶅姟鍣ㄥ唴閮ㄩ敊璇紝鏌ョ湅 msg 鑾峰彇璇︽儏   |

---

## 鐗堟湰鍘嗗彶

| 鐗堟湰   | 鏃ユ湡       | 璇存槑           |
|--------|------------|----------------|
| 1.0.0  | 2025-01-15 | 鍒濆鐗堟湰       |
| 1.1.0  | 2026-03-26 | 鏂板杞ㄨ抗鍔熻兘   |
