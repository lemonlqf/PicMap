package handler

import (
	"path/filepath"
	"testing"
)

// TestSafeJoinUnder 验证 zip 条目名拼接不会越出目标目录（zip-slip 防护）
func TestSafeJoinUnder(t *testing.T) {
	base := filepath.Join("base", "dir")

	valid := []string{
		"user1/images/schema/schema.json",
		"user1/tracks/_TRACK_PM_abc_foo.gpx",
		"a.txt",
		"sub/dir/file.jpg",
	}
	for _, name := range valid {
		got, err := safeJoinUnder(base, name)
		if err != nil {
			t.Errorf("%q: 期望合法，得到错误 %v", name, err)
			continue
		}
		want := filepath.Join(base, filepath.FromSlash(name))
		if got != want {
			t.Errorf("%q: 期望 %q，得到 %q", name, want, got)
		}
	}

	invalid := []string{
		"",
		"../evil.txt",
		"a/../../evil.txt",
		`..\evil.txt`,
		"../../outside/secret",
	}
	for _, name := range invalid {
		if _, err := safeJoinUnder(base, name); err == nil {
			t.Errorf("%q: 期望被拒绝，但通过了", name)
		}
	}

	// 绝对路径在 Windows 与 Unix 上语义不同，分别校验本平台的绝对路径写法
	abs := "/etc/passwd"
	if filepath.IsAbs(filepath.FromSlash(abs)) {
		if _, err := safeJoinUnder(base, abs); err == nil {
			t.Errorf("%q: 绝对路径应被拒绝", abs)
		}
	}
}

// TestIsSafePathSegment 验证用户ID/路径段校验
func TestIsSafePathSegment(t *testing.T) {
	ok := []string{"user1", "abc_123", "用户A"}
	for _, s := range ok {
		if !isSafePathSegment(s) {
			t.Errorf("%q: 期望合法", s)
		}
	}
	bad := []string{"", ".", "..", "a/b", `a\b`, "../x", "a..b"}
	for _, s := range bad {
		if isSafePathSegment(s) {
			t.Errorf("%q: 期望非法", s)
		}
	}
}
