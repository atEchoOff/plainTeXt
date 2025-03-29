import { InputRule, inputRules } from "prosemirror-inputrules";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";

// Global mathquill handler
let MQ = MathQuill.getInterface(2);

function focusMathQuillNode(view, pos, isLeft) {
    // Focus in a mathquill node on a specified side

    // Retrieve the mathquill node
    // FIXME this is terrible. We have the node when we are calling this
    // but I cannot find a way to turn that node into the actual element for mathquill
    const resolvedPos = view.state.doc.resolve(pos);
    const mathQuillNodeView = view.nodeDOM(resolvedPos.pos);

    // Get the mathquill api
    const mathField = MQ(mathQuillNodeView);
    if (mathField) {
        mathField.focus();
        if (isLeft) {
            mathField.moveToLeftEnd();
        } else {
            mathField.moveToRightEnd();
        }
    }
}

const mathQuillPlugin = new Plugin({
    key: new PluginKey("mathQuill"),
    props: {
        handleKeyDown(view, event) {
            // Handles entering into MQ element with l/r arrow keys
            const {selection, doc} = view.state;
            const {from, to} = selection;
  
            // Right arrow key, check if we're to the left of a MathQuill node
            if (event.key === "ArrowRight" && from === to) {
                const nodeAfter = doc.nodeAt(from);
                if (nodeAfter && nodeAfter.type.name === "mathquill") {
                    // This is a mathquill node, lets enter it
                    event.preventDefault();
                    focusMathQuillNode(view, from, true);
                    return true;
                }
            }
  
            // Left arrow key, check if we're to the right of a MathQuill node
            else if (event.key === "ArrowLeft" && from === to) {
                const nodeBefore = doc.nodeAt(from - 1);
                if (nodeBefore && nodeBefore.type.name === "mathquill") {
                    // This is a mathquill node, lets enter it
                    event.preventDefault();
                    focusMathQuillNode(view, from - 1, false);
                    return true;
                }
            }
            return false; // no changes were made
        },
    }
});

class MathQuillNodeView {
    constructor(node, view, getPos) {
        this.dom = document.createElement("span");
        this.getPos = getPos;
        this.mathField = MQ.MathField(this.dom, {
            handlers: {
                moveOutOf: function(dir, mathField) {
                    // Handle moving out of the mathquill node with l/r arrow keys

                    // Figure out where we are
                    let pos = getPos();
                    let {tr} = view.state;

                    if (dir == MQ.R) {
                        pos++;
                    }
                    
                    // Create selection for new cursor position
                    let selection = TextSelection.create(tr.doc, pos);
                    view.dispatch(tr.setSelection(selection).scrollIntoView());
                    view.focus(); // Focus on cursor outside of mathquill node
                },
            }
        });

        // Show latex in DOM (on node recreation, need to repopulate latex)
        this.mathField.latex(node.attrs.latex);
        if (node.attrs.initialize) {
            // Focus on creation
            setTimeout(() => {this.mathField.focus();}, 0);
        }

        // Event handlers
        this.dom.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.dom.querySelector('textarea').addEventListener('blur', (e) => this.handleBlur());
    }

    handleKeyDown(event) {
        if (event.key === ";") {
            // Leave focus and move cursor after mq node on ";"
            event.preventDefault();

            // Select after the node
            let pos = this.getPos() + 1;
            let {tr} = editor.state;
            let selection = TextSelection.create(tr.doc, pos);
            editor.dispatch(tr.setSelection(selection).scrollIntoView());
            editor.focus();
            return true;
        } else if (event.key === "Enter") {
            // Enter should do nothing inside mathquill elements
            event.preventDefault();
        }
    }

    handleBlur() {
        // Save latex in latex field when leaving mathquill
        // When mathquill object resets, it needs latex to render again
        const latex = this.mathField.latex();

        // Search for my node and set the new latex
        const pos = this.getPos();
        const tr = editor.state.tr.setNodeMarkup(pos, null, {latex: latex});
        editor.dispatch(tr);
    }
}

const mathQuillNodeSpec = {
    atom: true,
    inline: true,
    group: "inline",
    selectable: true,
    toDOM: () => ["span", {}],
    parseDOM: [{
        tag: "span",
    }],
    attrs: {
        latex: {default: ''}, // latex of the math element. Empty on creation
        initialize: {default: false}, // only true on first creation, used for initial focus
    }
};

function insertMathQuillRule() {
    // Create a mathquill node on ;
    return new InputRule(/;$/, (state, match, start, end) => {
        // Define the new node
        // initialize = true to focus on creation
        const mathquillNode = schema.nodes.mathquill.create({initialize: true});

        // Commit to prosemirror
        const transaction = state.tr.replaceRangeWith(start, end, mathquillNode);
        return transaction;
    });
}

// Convert to plugin for prosemirror
const mathQuillInputRule = inputRules({
    rules: [insertMathQuillRule()],
});