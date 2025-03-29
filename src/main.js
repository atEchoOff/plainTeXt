import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser } from "prosemirror-model";
import { history, undo, redo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";

// Prosemirror editor object
let editor = null;

// DOM editor element
let editorElement = document.getElementById("editor");

// Define the 'doc' node
const docSpec = {
    content: "block+"
};
  
// Define the 'paragraph' node
const paragraphSpec = {
    content: "inline*",
    group: "block",
    parseDOM: [{tag: "p"}],
    toDOM: () => ["p", 0]
};
  
// Define the 'text' node
const textSpec = {
    group: "inline"
};

// Load in mathquill setup
// this is a fake command, babel doesnt like to combine files for some reason
import_from_local("mathquill.js");

const schema = new Schema({
    nodes: {
        // Include all specs
        doc: docSpec,
        paragraph: paragraphSpec,
        text: textSpec,
        mathquill: mathQuillNodeSpec,
    }
});

editor = new EditorView(editorElement, {
    state: EditorState.create({
        doc: DOMParser.fromSchema(schema).parse(editorElement),
            plugins: [
                history(),
                keymap({"Mod-z":undo, "Mod-y":redo}),
                keymap(baseKeymap),
                mathQuillInputRule, // Create mathquill element on ;
                mathQuillPlugin
            ],
        }),
        nodeViews: {
            mathquill(node, view, getPos) {
                return new MathQuillNodeView(node, view, getPos);
            },
        }
});

// Highlight mathquill elements if needed
document.addEventListener('selectionchange', refreshHighlights);

import_from_local("save-open.js");