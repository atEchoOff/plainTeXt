import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser } from "prosemirror-model";
import { history, undo, redo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap, toggleMark } from "prosemirror-commands";
import { schema as basicSchema } from "prosemirror-schema-basic";

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
    }, 
    marks: {
        strong: basicSchema.spec.marks.get("strong"),
        em: basicSchema.spec.marks.get("em"),
        link: basicSchema.spec.marks.get("link"),
        code: basicSchema.spec.marks.get("code"),
        section: {
            parseDOM: [{tag: "h2"}],
            toDOM() { return ["h2", 0] }
        },
        subsection: {
            parseDOM: [{tag: "h3"}],
            toDOM() { return ["h3", 0] }
        },
    }
});

schema.marks.link.spec.inclusive = true;

// Toggle mark, disable all other marks
function steamrollMark(mark) {

    // The command to return
    function command(state, dispatch) {
        // Create a dispatch that adds commands to delete all other marks at selection first
        const {from, to} = state.selection;
        function newDispatch(transaction) {
            for (let markName in schema.marks) {
                if (markName !== mark.name) {
                    transaction = transaction.removeMark(from, to, schema.marks[markName]);
                    transaction = transaction.removeStoredMark(schema.marks[markName]);
                }
            }

            return dispatch(transaction);
        }

        // Toggle the mark :)
        toggleMark(mark)(state, newDispatch)
        return true; // do not do default action
    }

    return command;
}

const toggleBold = steamrollMark(schema.marks.strong);
const toggleItalics = steamrollMark(schema.marks.em);
const toggleLink = steamrollMark(schema.marks.link);
const toggleCode = steamrollMark(schema.marks.code);
const toggleSection = steamrollMark(schema.marks.section);
const toggleSubsection = steamrollMark(schema.marks.subsection);

editor = new EditorView(editorElement, {
    state: EditorState.create({
        doc: DOMParser.fromSchema(schema).parse(editorElement),
            plugins: [
                history(),
                keymap({
                    "Mod-z":undo, 
                    "Mod-y":redo, 
                    "Mod-b":toggleBold, 
                    "Mod-i":toggleItalics,
                    "Mod-l":toggleLink,
                    "Mod-r":toggleCode,
                    "Shift-Mod-s":toggleSection,
                    "Mod-s":toggleSubsection
                }),
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
document.addEventListener('selectionchange', () => setTimeout(() => {refreshHighlights()}, 0));
document.addEventListener('click', (event) => {
    if (event.target.tagName === "A") {
        // We will attempt to scroll to the first mathquill element above the label
        $('.mq-label:contains("' + event.target.innerText + '")').get().forEach((label) => {
            if (label.compareDocumentPosition(event.target) & 0x04) {
                label.scrollIntoView();
            }
        })
    }
})
import_from_local("save-open.js");