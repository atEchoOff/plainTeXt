import {
    EditorView as CodeMirror, keymap as cmKeymap, drawSelection,
    lineNumbers
} from "@codemirror/view"
import { python } from "@codemirror/lang-python"
import { javascript } from "@codemirror/lang-javascript"
import { java } from "@codemirror/lang-java"
import { defaultKeymap, indentWithTab } from "@codemirror/commands"
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language"

import { exitCode } from "prosemirror-commands"

function getLanguage(lang_string) {
    // Return language given string
    if (lang_string == "python") {
        return python();
    } else if (lang_string == "javascript") {
        return javascript();
    } else if (lang_string == "java") {
        return java();
    }
}

// Most of this code is from the prosemirror-codemirror example
// https://prosemirror.net/examples/codemirror/

class CodeBlockView {
    constructor(node, view, getPos) {
        // Store for later
        this.node = node
        this.view = view
        this.getPos = getPos

        // Create a CodeMirror instance
        this.cm = new CodeMirror({
            doc: this.node.textContent,
            extensions: [
                cmKeymap.of([
                    ...this.codeMirrorKeymap(),
                    ...defaultKeymap,
                    indentWithTab
                ]),
                lineNumbers(),
                drawSelection(),
                syntaxHighlighting(defaultHighlightStyle),
                getLanguage(node.attrs.lang),
                CodeMirror.updateListener.of(update => this.forwardUpdate(update))
            ]
        })

        // The editor's outer node is our DOM representation
        this.dom = this.cm.dom

        // This flag is used to avoid an update loop between the outer and
        // inner editor
        this.updating = false

        if (node.attrs.initialize) {
            // Focus on creation
            nextFrame(() => { this.cm.focus() });
        }
    }

    forwardUpdate(update) {
        if (this.updating || !this.cm.hasFocus) return
        let offset = this.getPos() + 1, { main } = update.state.selection
        let selFrom = offset + main.from, selTo = offset + main.to
        let pmSel = this.view.state.selection
        if (update.docChanged || pmSel.from != selFrom || pmSel.to != selTo) {
            let tr = this.view.state.tr
            update.changes.iterChanges((fromA, toA, fromB, toB, text) => {
                if (text.length)
                    tr.replaceWith(offset + fromA, offset + toA,
                        schema.text(text.toString()))
                else
                    tr.delete(offset + fromA, offset + toA)
                offset += (toB - fromB) - (toA - fromA)
            })
            tr.setSelection(TextSelection.create(tr.doc, selFrom, selTo))
            this.view.dispatch(tr)
        }

        // Search for my node and set the new code
        // node may no longer exist (ex. ctrl+z on element)
        // In that case, we want to focus where we were before
        const pos = this.getPos();
        if (pos !== undefined) {
            const tr = editor.state.tr.setNodeMarkup(pos, null, { lang: this.node.attrs.lang, code: this.cm.state.doc.toString() });
            editor.dispatch(tr);
        } else {
            // node no longer exists, focus where it used to be
            editor.focus();
        }
    }

    setSelection(anchor, head) {
        this.cm.focus()
        this.updating = true
        this.cm.dispatch({ selection: { anchor, head } })
        this.updating = false
    }

    codeMirrorKeymap() {
        let view = this.view
        return [
            { key: "ArrowUp", run: () => this.maybeEscape("line", -1) },
            { key: "ArrowLeft", run: () => this.maybeEscape("char", -1) },
            { key: "ArrowDown", run: () => this.maybeEscape("line", 1) },
            { key: "ArrowRight", run: () => this.maybeEscape("char", 1) },
            {
                key: "Ctrl-Enter", run: () => {
                    if (!exitCode(view.state, view.dispatch)) return false
                    view.focus()
                    return true
                }
            },
            {
                key: "Ctrl-z", mac: "Cmd-z",
                run: () => undo(view.state, view.dispatch)
            },
            {
                key: "Ctrl-y", mac: "Cmd-y",
                run: () => redo(view.state, view.dispatch)
            }
        ]
    }

    maybeEscape(unit, dir) {
        let { state } = this.cm, { main } = state.selection
        if (!main.empty) return false
        if (unit == "line") main = state.doc.lineAt(main.head)
        if (dir < 0 ? main.from > 0 : main.to < state.doc.length) return false

        let targetPos = this.getPos() + (dir < 0 ? 0 : this.node.nodeSize);
        let selection = TextSelection.near(this.view.state.doc.resolve(targetPos), dir);
        if (selection.$anchor.parent.type.name == "codeBlock") {
            // We would otherwise be stuck in the code block. Make a text node above/below.

            // Determine the position to insert the new paragraph in the main ProseMirror doc.
            const nodePos = this.getPos();
            const insertPos = (dir < 0) ? nodePos : nodePos + this.node.nodeSize;

            const newNode = this.view.state.schema.nodes.paragraph.createAndFill();

            // Build the transaction
            const tr = this.view.state.tr;
            tr.insert(insertPos, newNode)
            tr.setSelection(TextSelection.create(tr.doc, insertPos + 1))
            tr.scrollIntoView();

            // Dispatch the transaction and focus the main editor view.
            this.view.dispatch(tr);
            this.view.focus();
        } else {
            // Simply move into existing node
            let tr = this.view.state.tr.setSelection(selection).scrollIntoView();
            this.view.dispatch(tr);
            this.view.focus();
        }
    }

    update(node) {
        if (node.type != this.node.type) return false
        this.node = node
        if (this.updating) return true
        let newText = node.textContent, curText = this.cm.state.doc.toString()
        if (newText != curText) {
            let start = 0, curEnd = curText.length, newEnd = newText.length
            while (start < curEnd &&
                curText.charCodeAt(start) == newText.charCodeAt(start)) {
                ++start
            }
            while (curEnd > start && newEnd > start &&
                curText.charCodeAt(curEnd - 1) == newText.charCodeAt(newEnd - 1)) {
                curEnd--
                newEnd--
            }
            this.updating = true
            this.cm.dispatch({
                changes: {
                    from: start, to: curEnd,
                    insert: newText.slice(start, newEnd)
                }
            })
            this.updating = false
        }
        return true
    }

    selectNode() { this.cm.focus() }
    stopEvent() { return true }
}

function arrowHandler(dir) {
    return (state, dispatch, view) => {
        if (state.selection.empty && view.endOfTextblock(dir)) {
            let side = dir == "left" || dir == "up" ? -1 : 1
            let $head = state.selection.$head
            let nextPos = Selection.near(
                state.doc.resolve(side > 0 ? $head.after() : $head.before()), side)
            if (nextPos.$head && nextPos.$head.parent.type.name == "code_block") {
                dispatch(state.tr.setSelection(nextPos))
                return true
            }
        }
        return false
    }
}

const arrowHandlers = keymap({
    ArrowLeft: arrowHandler("left"),
    ArrowRight: arrowHandler("right"),
    ArrowUp: arrowHandler("up"),
    ArrowDown: arrowHandler("down")
});

const codeBlockSpec = {
    content: "text*",
    marks: "",
    group: "block",
    code: true,
    defining: true,
    isolating: true,
    attrs: {
        lang: { default: null },
        initialize: { default: false }, // only true on first creation, used for initial focus
        code: { default: null } // set code on first creation
    },
    parseDOM: [
        {
            tag: "pre",
            preserveWhitespace: "full",
            getAttrs: (node) => {
                if (node instanceof HTMLElement) {
                    return { lang: node.getAttribute("data-lang") };
                }
                return {};
            },
        },
    ],
    toDOM(node) {
        return ["pre", { "data-lang": node.attrs.lang }, ["code", 0]];
    },
};