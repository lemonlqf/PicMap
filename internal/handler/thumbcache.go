package handler

import (
	"container/list"
	"strings"
	"sync"
)

// thumbCacheLRU 带容量上限的线程安全 LRU 缓存，用于存放缩略图 base64，
// 避免长期运行时缓存只增不减导致内存持续上涨。
type thumbCacheLRU struct {
	mu       sync.Mutex
	capacity int
	items    map[string]*list.Element
	order    *list.List // 元素为 *lruEntry，Front 为最近使用
}

type lruEntry struct {
	key   string
	value string
}

func newThumbCacheLRU(capacity int) *thumbCacheLRU {
	if capacity < 1 {
		capacity = 1
	}
	return &thumbCacheLRU{
		capacity: capacity,
		items:    make(map[string]*list.Element),
		order:    list.New(),
	}
}

// Get 命中时返回缓存值并标记为最近使用
func (c *thumbCacheLRU) Get(key string) (string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.items[key]; ok {
		c.order.MoveToFront(el)
		return el.Value.(*lruEntry).value, true
	}
	return "", false
}

// Put 写入缓存；超出容量时淘汰最久未使用的条目
func (c *thumbCacheLRU) Put(key, value string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.items[key]; ok {
		el.Value.(*lruEntry).value = value
		c.order.MoveToFront(el)
		return
	}
	el := c.order.PushFront(&lruEntry{key: key, value: value})
	c.items[key] = el
	for c.order.Len() > c.capacity {
		oldest := c.order.Back()
		if oldest == nil {
			break
		}
		c.order.Remove(oldest)
		delete(c.items, oldest.Value.(*lruEntry).key)
	}
}

// Delete 删除指定 key
func (c *thumbCacheLRU) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.items[key]; ok {
		c.order.Remove(el)
		delete(c.items, key)
	}
}

// DeleteByPrefix 删除所有以 prefix 开头的 key（用于按用户清理）
func (c *thumbCacheLRU) DeleteByPrefix(prefix string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for key, el := range c.items {
		if strings.HasPrefix(key, prefix) {
			c.order.Remove(el)
			delete(c.items, key)
		}
	}
}

// Len 当前条目数（测试用）
func (c *thumbCacheLRU) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.order.Len()
}
