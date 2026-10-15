package scope_test

import (
	"go/parser"
	"go/token"
	"io/fs"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// Guard dependency direction as code evolves. Integration tests prove the
// behavior; this check prevents persistence/transport coupling from returning.
func TestCleanArchitectureDependencies(t *testing.T) {
	root := filepath.Join("..")
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		layer := strings.Split(filepath.ToSlash(rel), "/")[0]
		parsed, err := parser.ParseFile(token.NewFileSet(), path, nil, parser.ImportsOnly)
		if err != nil {
			return err
		}
		for _, spec := range parsed.Imports {
			imported, err := strconv.Unquote(spec.Path.Value)
			if err != nil {
				return err
			}
			internal := strings.TrimPrefix(imported, "scopematch/internal/")
			local := internal != imported
			allowed := true
			switch layer {
			case "domain":
				allowed = !local && !strings.Contains(strings.Split(imported, "/")[0], ".") && imported != "database/sql" && !strings.HasPrefix(imported, "net/")
			case "library":
				allowed = (!local || internal == "domain") && imported != "database/sql" && !strings.HasPrefix(imported, "net/") && !strings.Contains(strings.Split(imported, "/")[0], ".")
			case "scope":
				allowed = (!local || internal == "domain" || internal == "library") && imported != "database/sql" && !strings.HasPrefix(imported, "net/") && !strings.Contains(strings.Split(imported, "/")[0], ".")
			case "api":
				allowed = (!local || internal == "domain" || internal == "scope" || internal == "library") && imported != "database/sql" && !strings.Contains(strings.Split(imported, "/")[0], ".")
			case "store":
				allowed = !local || internal == "domain" || internal == "scope"
			}
			if !allowed {
				t.Errorf("%s: %s must not depend on %s", rel, layer, imported)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
