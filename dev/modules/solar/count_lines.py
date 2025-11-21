# Run from folder indeform_praktika :
# python ./dev/modules/solar/count_lines.py ./dev/modules/solar/
# python ./dev/modules/solar/count_lines.py ./dev/modules/solar/ --verbose

import argparse
import os
from pathlib import Path


class TreeNode:
    """Represents a node in the directory/file tree."""

    def __init__(self, name, is_file=False):
        self.name = name
        self.is_file = is_file
        self.children = {} 
        self.total_lines = 0
        self.empty_lines = 0
        self.comment_lines = 0
        self.code_lines = 0


def analyze_file_content(file_path):
    """Count different types of lines in a file."""
    try:
        with open(file_path, encoding="utf-8") as f:
            lines = f.readlines()

        total_lines = len(lines)
        empty_lines = 0
        comment_lines = 0

        for line in lines:
            stripped = line.strip()
            if not stripped:
                empty_lines += 1
            elif (
                stripped.startswith("#")
                or stripped.startswith("//")
                or stripped.startswith("/*")
                or stripped.startswith("*")
                or stripped.startswith("*/")
            ):
                comment_lines += 1

        code_lines = total_lines - empty_lines - comment_lines
        return total_lines, empty_lines, comment_lines, code_lines
    except UnicodeDecodeError:
        return 0, 0, 0, 0
    except Exception:
        return 0, 0, 0, 0


def get_files(paths, exclude_dirs, extensions=None):
    """Collect files from paths, excluding specified directories and filtering by extensions."""
    files = []
    script_name = os.path.basename(__file__) 

    for path in paths:
        if os.path.isfile(path):
            # skip this script 
            if os.path.basename(path) == script_name:
                continue

            if extensions is None or Path(path).suffix in extensions:
                files.append(path)
        else:
            for root, dirs, filenames in os.walk(path):
                # exclude directories
                dirs[:] = [d for d in dirs if d not in exclude_dirs]
                for filename in filenames:
                    # skip this script 
                    if filename == script_name:
                        continue

                    file_path = os.path.join(root, filename)
                    if extensions is None or Path(filename).suffix in extensions:
                        files.append(file_path)
    return files


def split_path(path):
    """Split a file path into components using pathlib."""
    p = Path(path)
    parts = []
    while p.name != "":
        parts.insert(0, p.name)
        p = p.parent
    return parts


def compute_totals(node):
    """Recursively compute total lines for directories."""
    if node.is_file:
        return node.total_lines, node.empty_lines, node.comment_lines, node.code_lines

    total = 0
    empty = 0
    comment = 0
    code = 0

    for child in node.children.values():
        child_total, child_empty, child_comment, child_code = compute_totals(child)
        total += child_total
        empty += child_empty
        comment += child_comment
        code += child_code

    node.total_lines = total
    node.empty_lines = empty
    node.comment_lines = comment
    node.code_lines = code
    return total, empty, comment, code


def print_tree(node, indent=0, is_last=False, prefix=""):
    """Print the tree hierarchy with line counts."""
    line_stats = (
        f"{node.total_lines} lines ({node.code_lines} code, {node.comment_lines} comments, {node.empty_lines} empty)"
    )

    if indent == 0:
        print(f"{node.name} ({line_stats})")
    else:
        connector = "└── " if is_last else "├── "
        print(f"{prefix}{connector}{node.name} ({line_stats})")

    if not node.is_file:
        children = sorted(node.children.values(), key=lambda x: (not x.is_file, x.name))
        for i, child in enumerate(children):
            is_last_child = i == len(children) - 1
            new_prefix = prefix + ("    " if is_last else "│   ")
            print_tree(child, indent + 1, is_last_child, new_prefix)


def main():
    parser = argparse.ArgumentParser(description="Count lines of code with hierarchical verbose output.")
    parser.add_argument("paths", nargs="+", help="Files/directories to process")
    parser.add_argument("--exclude-dir", action="append", default=[], help="Directories to exclude (e.g., `venv`)")
    parser.add_argument("--extensions", nargs="*", help="File extensions to include (e.g., `.py .js`)")
    parser.add_argument("--verbose", action="store_true", help="Show hierarchical line counts")
    args = parser.parse_args()

    default_exclude = [".git", "__pycache__", "node_modules", "venv", "migrations"]
    exclude_dirs = set(args.exclude_dir + default_exclude)

    root_nodes = []
    total_lines = 0
    total_empty = 0
    total_comments = 0
    total_code = 0

    for input_path in args.paths:
        files = get_files([input_path], exclude_dirs, args.extensions)

        file_analyses = []
        for file in files:
            t_lines, e_lines, c_lines, code_lines = analyze_file_content(file)
            file_analyses.append((file, t_lines, e_lines, c_lines, code_lines))

        input_name = os.path.basename(input_path)
        is_file = os.path.isfile(input_path)
        root_node = TreeNode(input_name, is_file=is_file)

        if is_file:
            if file_analyses and file_analyses[0][0] == input_path:
                root_node.total_lines = file_analyses[0][1]
                root_node.empty_lines = file_analyses[0][2]
                root_node.comment_lines = file_analyses[0][3]
                root_node.code_lines = file_analyses[0][4]
        else:
            for file, t_lines, e_lines, c_lines, code_lines in file_analyses:
                rel_path = os.path.relpath(file, input_path)
                components = split_path(rel_path)
                current_node = root_node
                for component in components[:-1]:
                    if component not in current_node.children:
                        current_node.children[component] = TreeNode(component)
                    current_node = current_node.children[component]

                file_component = components[-1]
                current_node.children[file_component] = TreeNode(file_component, is_file=True)
                file_node = current_node.children[file_component]
                file_node.total_lines = t_lines
                file_node.empty_lines = e_lines
                file_node.comment_lines = c_lines
                file_node.code_lines = code_lines

            compute_totals(root_node)

        root_nodes.append(root_node)
        total_lines += root_node.total_lines
        total_empty += root_node.empty_lines
        total_comments += root_node.comment_lines
        total_code += root_node.code_lines

    if args.verbose:
        for root_node in root_nodes:
            print_tree(root_node)
            print()

    print(f"Total lines: {total_lines} (Code: {total_code}, Comments: {total_comments}, Empty: {total_empty})")


if __name__ == "__main__":
    main()
