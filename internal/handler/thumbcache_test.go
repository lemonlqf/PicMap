package handler

import "testing"

func TestThumbCacheLRUEviction(t *testing.T) {
	c := newThumbCacheLRU(2)
	c.Put("a", "1")
	c.Put("b", "2")
	// 访问 a，使 b 成为最久未使用
	if v, ok := c.Get("a"); !ok || v != "1" {
		t.Fatalf("expected a=1, got %q ok=%v", v, ok)
	}
	// 写入 c 触发淘汰，应淘汰 b
	c.Put("c", "3")
	if _, ok := c.Get("b"); ok {
		t.Fatal("expected b to be evicted")
	}
	if v, ok := c.Get("a"); !ok || v != "1" {
		t.Fatalf("expected a=1 after eviction, got %q ok=%v", v, ok)
	}
	if v, ok := c.Get("c"); !ok || v != "3" {
		t.Fatalf("expected c=3, got %q ok=%v", v, ok)
	}
	if c.Len() != 2 {
		t.Fatalf("expected len 2, got %d", c.Len())
	}
}

func TestThumbCacheLRUUpdate(t *testing.T) {
	c := newThumbCacheLRU(2)
	c.Put("a", "1")
	c.Put("a", "2")
	if v, ok := c.Get("a"); !ok || v != "2" {
		t.Fatalf("expected a=2, got %q ok=%v", v, ok)
	}
	if c.Len() != 1 {
		t.Fatalf("expected len 1, got %d", c.Len())
	}
}

func TestThumbCacheLRUDeleteByPrefix(t *testing.T) {
	c := newThumbCacheLRU(10)
	c.Put("u1/a", "1")
	c.Put("u1/b", "2")
	c.Put("u2/c", "3")
	c.DeleteByPrefix("u1/")
	if _, ok := c.Get("u1/a"); ok {
		t.Fatal("expected u1/a removed")
	}
	if _, ok := c.Get("u1/b"); ok {
		t.Fatal("expected u1/b removed")
	}
	if v, ok := c.Get("u2/c"); !ok || v != "3" {
		t.Fatalf("expected u2/c=3, got %q ok=%v", v, ok)
	}
	if c.Len() != 1 {
		t.Fatalf("expected len 1, got %d", c.Len())
	}
}

func TestThumbCacheLRUDelete(t *testing.T) {
	c := newThumbCacheLRU(10)
	c.Put("a", "1")
	c.Delete("a")
	if _, ok := c.Get("a"); ok {
		t.Fatal("expected a removed")
	}
	if c.Len() != 0 {
		t.Fatalf("expected len 0, got %d", c.Len())
	}
}
