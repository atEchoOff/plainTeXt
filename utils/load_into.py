import sys

newlines = []
with(open(sys.argv[1])) as lines:
    for line in lines:
        if line.startswith("import_from_local("):
            file = line[len("import_from_local('"):line.rindex(")") - 1]
            contents = open(f"src/{file}").read()
            newlines.append(contents)
            newlines.append("\n")
        else:
            newlines.append(line)

print("".join(newlines))