import { InputRule, inputRules } from "prosemirror-inputrules";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Fragment, Slice } from "prosemirror-model";

// Global mathquill handler
let MQ = MathQuill.getInterface(2);

function focusMathQuillNode(view, pos, isLeft) {
    // Focus in a mathquill node on a specified side

    // Retrieve the mathquill node
    // FIXME this is terrible. We have the node when we are calling this
    // but I cannot find a way to turn that node into the actual element for mathquill
    const mathQuillNodeView = view.nodeDOM(pos);

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

function fragToTextFrag(fragment) {
    // Convert fragment to latex form for copy
    let nodes = [];
    fragment.forEach((child) => {
        if (child.type.name === "mathquill") {
            // Convert mathquill node to $latex$ textnode
            const textNode = schema.text("$" + child.attrs.latex + "$");
            nodes.push(textNode);
        } else if (child.type.name === "codeBlock") {
            const textNode = schema.text("\\" + child.attrs.lang + "{" + encodeURIComponent(child.attrs.code) + "}");
            nodes.push(textNode);
        } else if (child.type.name === "image") {
            nodes.push(child.copy(child));
        } else if (child.type.name === "text" && child.marks.length) {
            // Serialize mark as latex
            if (child.marks[0].type.name === "strong") {
                const textNode = schema.text("\\textbf{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "em") {
                const textNode = schema.text("\\textit{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "link") {
                const textNode = schema.text("\\eqref{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "code") {
                const textNode = schema.text("\\texttt{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "section") {
                const textNode = schema.text("\\section{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "subsection") {
                const textNode = schema.text("\\subsection{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "citation") {
                const textNode = schema.text("\\cite{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "theorem") {
                const textNode = schema.text("\\theorem{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "qed") {
                const textNode = schema.text("\\qed{ }");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "label") {
                const textNode = schema.text("\\label{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "definition") {
                const textNode = schema.text("\\definition{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "proposition") {
                const textNode = schema.text("\\proposition{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "corollary") {
                const textNode = schema.text("\\corollary{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "lemma") {
                const textNode = schema.text("\\lemma{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "remark") {
                const textNode = schema.text("\\remark{" + child.text + "}");
                nodes.push(textNode);
            }
        } else if (child.content) {
            // For non-leaf nodes, recursively transform their content
            nodes.push(child.copy(fragToTextFrag(child.content)));
        } else {
            // Leaf nodes that are not MathQuill nodes are unchanged
            nodes.push(child);
        }
    });
    return Fragment.fromArray(nodes);
}

function textToFrag(pastedText) {
    // "Inverse" of fragToTextFrag
    // Convert string text to fragment to paste
    // Look for $...$ for math or \textbf{...} etc
    const mqregex = /(\$[^\$]*\$)|/
    const textbfregex = /(\\textbf\{((?!\\textbf\{)[^}]*)\})|/
    const textitregex = /(\\textit\{((?!\\textit\{)[^}]*)\})|/
    const eqrefregex = /(\\eqref\{((?!\\eqref\{)[^}]*)\})|/
    const textttregex = /(\\texttt\{((?!\\texttt\{)[^}]*)\})|/
    const sectionregex = /(\\section\{((?!\\section\{)[^}]*)\})|/
    const subsectionregex = /(\\subsection\{((?!\\subsection\{)[^}]*)\})|/
    const citeregex = /(\\cite\{((?!\\cite\{)[^}]*)\})|/
    const imageregex = /(\\includegraphics\{((?!\\includegraphics\{)[^}]*)\})|/
    const theoremregex = /(\\theorem\{((?!\\theorem\{)[^}]*)\})|/
    const qedregex = /(\\qed\{((?!\\qed\{)[^}]*)\})|/
    const labelregex = /(\\label\{((?!\\label\{)[^}]*)\})|/
    const definitionregex = /(\\definition\{((?!\\definition\{)[^}]*)\})|/
    const propositionregex = /(\\proposition\{((?!\\proposition\{)[^}]*)\})|/
    const corollaryregex = /(\\corollary\{((?!\\corollary\{)[^}]*)\})|/
    const lemmaregex = /(\\lemma\{((?!\\lemma\{)[^}]*)\})|/
    const remarkregex = /(\\remark\{((?!\\remark\{)[^}]*)\})|/

    const pythonregex = /(\\python\{((?!\\python\{)[^}]*)\})|/
    const javascriptregex = /(\\javascript\{((?!\\javascript\{)[^}]*)\})|/
    const javaregex = /(\\java\{((?!\\java\{)[^}]*)\})/

    const regex = new RegExp(
        mqregex.source + 
        textbfregex.source + 
        textitregex.source +
        eqrefregex.source +
        textttregex.source +
        sectionregex.source +
        subsectionregex.source +
        citeregex.source +
        imageregex.source +
        theoremregex.source +
        qedregex.source +
        labelregex.source +
        definitionregex.source +
        propositionregex.source +
        corollaryregex.source +
        lemmaregex.source +
        remarkregex.source +
        pythonregex.source +
        javascriptregex.source +
        javaregex.source
    , "g")
    let lastIndex = 0;
    let nodes = [];
    
    // Loop through matches
    pastedText.replace(regex, (match, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21, p22, p23, p24, p25, p26, p27, p28, p29, p30, p31, p32, p33, p34, p35, p36, p37, p38, p39, offset) => {
        let text = pastedText.slice(lastIndex, offset);
        if (offset > lastIndex) {
            // This is text
            nodes.push(schema.text(text));
        }

        if (p1) {
            // This is math
            //                                               v Remove the $ from the start and end
            nodes.push(schema.nodes.mathquill.create({latex: p1.slice(1, -1)}));

            lastIndex = offset + match.length;
        } else if (p3) {
            // This is bold text
            nodes.push(schema.text(p3, [schema.marks.strong.create()]));

            lastIndex = offset + match.length;
        } else if (p5) {
            // This is italics text
            nodes.push(schema.text(p5, [schema.marks.em.create()]));

            lastIndex = offset + match.length;
        } else if (p7) {
            // This is a link
            nodes.push(schema.text(p7, [schema.marks.link.create()]));

            lastIndex = offset + match.length;
        } else if (p9) {
            // This is a link
            nodes.push(schema.text(p9, [schema.marks.code.create()]));

            lastIndex = offset + match.length;
        } else if (p11) {
            // This is a section
            nodes.push(schema.text(p11, [schema.marks.section.create()]));

            lastIndex = offset + match.length;
        } else if (p13) {
            // This is a subsection
            nodes.push(schema.text(p13, [schema.marks.subsection.create()]));

            lastIndex = offset + match.length;
        } else if (p15) {
            // This is a citation
            nodes.push(schema.text(p15, [schema.marks.citation.create()]));

            lastIndex = offset + match.length;
        } else if (p17) {
            // This is an image, should be in format
            // id caption
            let id = p17.substring(0, p17.indexOf(" "));
            let caption = p17.substring(p17.indexOf(" ") + 1);
            if (id in imageData) {
                // We are currently setting up, and a previous definition already exists for img
                let imgNode = schema.nodes.image.create({
                    src:imageData[id]['src'],
                    title:decodeURIComponent(caption),
                    aria:''
                }, textToFrag(decodeURIComponent(caption)));

                nodes.push(imgNode);
                // The imageData is done for this, we can remove it
                // If we keep it in, images will reset themselves from global dictionary
                delete imageData[p17];
            }
            lastIndex = offset + match.length;
        } else if (p19) {
            // This is a theorem
            nodes.push(schema.text(p19, [schema.marks.theorem.create()]));

            lastIndex = offset + match.length;
        } else if (p21) {
            // This is a theorem
            nodes.push(schema.text(" ", [schema.marks.qed.create()]));

            lastIndex = offset + match.length;
        } else if (p23) {
            // This is a label
            nodes.push(schema.text(p23, [schema.marks.label.create()]));

            lastIndex = offset + match.length;
        } else if (p25) {
            // This is a definition
            nodes.push(schema.text(p25, [schema.marks.definition.create()]));

            lastIndex = offset + match.length;
        } else if (p27) {
            // This is a proposition
            nodes.push(schema.text(p27, [schema.marks.proposition.create()]));

            lastIndex = offset + match.length;
        } else if (p29) {
            // This is a corollary
            nodes.push(schema.text(p29, [schema.marks.corollary.create()]));

            lastIndex = offset + match.length;
        } else if (p31) {
            // This is a lemma
            nodes.push(schema.text(p31, [schema.marks.lemma.create()]));

            lastIndex = offset + match.length;
        } else if (p33) {
            // This is a remark
            nodes.push(schema.text(p33, [schema.marks.remark.create()]));

            lastIndex = offset + match.length;
        } else if (p35) {
            // This is python code
            const decoded = decodeURIComponent(p35);
            nodes.push(schema.nodes.codeBlock.create({lang: "python", code: decoded}, schema.text(decoded)));
            
            lastIndex = offset + match.length;
        } else if (p37) {
            // This is javascript code
            const decoded = decodeURIComponent(p37);
            nodes.push(schema.nodes.codeBlock.create({lang: "javascript", code: decoded}, schema.text(decoded)));

            lastIndex = offset + match.length;
        } else if (p39) {
            // This is javascript code
            const decoded = decodeURIComponent(p39);
            nodes.push(schema.nodes.codeBlock.create({lang: "java", code: decoded}, schema.text(decoded)));

            lastIndex = offset + match.length;
        }
    });
    
    // Add any remaining text
    if (lastIndex < pastedText.length) {
        nodes.push(schema.text(pastedText.slice(lastIndex)));
    }

    return nodes;
}

function verticalAlign(mathquillElement) {
    // If possible, align mathquill element by its first aligned character
    // This will make sure mathquill elements align vertically with horizontal text
    let rootBlock = mathquillElement.lastChild.firstChild;

    // Move through parenthesis/brackets until we get to aligned math
    while (rootBlock && rootBlock.classList && rootBlock.classList.contains("mq-bracket-container")) {
        rootBlock = rootBlock.children[1].firstChild;
    }

    // If rootBlock is a mq-non-leaf and its first child is a mq-diacritic-stem, move to stem contents

    if (rootBlock && rootBlock.classList.contains("mq-non-leaf") && rootBlock.firstChild && rootBlock.firstChild.classList.contains("mq-diacritic-above")) {
        rootBlock = rootBlock.firstChild.nextSibling;
    }

    if (rootBlock === null || rootBlock.classList === null) {
        return;
    }

    // Line up the mathquill container so that the aligned text is centered vertically
    let root = rootBlock.getBoundingClientRect();
    let container = mathquillElement.getBoundingClientRect();
    mathquillElement.style.verticalAlign = (root.top - container.top)/2 + (root.bottom - container.bottom)/2 + 2 + "px"
}

function arrayOfTextNodesToText(textNodes) {
    // Take an array of textnodes, combine their text
    let textFrag = fragToTextFrag(textNodes);
    
    return textFrag.content[0].text;
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

        handleClick(view, pos, event) {
            // This isn't really for mathquill, but will disable the ctrl+click event
            return ctrlKey(event);
        },

        transformCopied(slice) {
            // Copy elements right from editor
            const newContent = fragToTextFrag(slice.content);

            return new Slice(newContent, slice.openStart, slice.openEnd);
        },

        clipboardTextSerializer(slice) {
            // Handle how the text on the clipboard looks after copying
            // This is necessary because transformCopied will double empty spaces
            const newContent = fragToTextFrag(slice.content);

            let lines = [];
            let imgCounter = 0;
            for (let node of newContent.content) {
                let fragment = node.content;
                
                if (node.type.name == "text") {
                    // This is a code block text node, it is not an empty line despite fragment.size == 0
                    lines.push(node.text);
                }
                else if (fragment.size == 0) {
                    // Empty fragments are just empty lines
                    lines.push("");
                } else if (fragment.content && fragment.content.type && fragment.content.type.name === "image") {
                    // The counter is meaningless unless copying the whole doc
                    // For now it is needed to save images between sessions
                    let text = arrayOfTextNodesToText(fragment.content.content.content);
                    lines.push("\\includegraphics{" + (imgCounter++) + " " + encodeURIComponent(text) + "}");
                } else if (fragment.type && fragment.type.name === "image") {
                    let text = arrayOfTextNodesToText(fragment.content.content);
                    lines.push("\\includegraphics{" + (imgCounter++) + " " + encodeURIComponent(text) + "}");
                } else {
                    lines.push(fragment.content[0].text);
                }
            }

            return lines.join("\n")
            .replaceAll(/\$\s*\\begin\{align\}/g, "\\begin{align*}")
            .replaceAll(/\\end\{align\}\s*\$/g, "\\end{align*}");
        },

        transformPasted(slice) {
            // Convert latex-formatted slice into pm
            // This is part 2 of pasting
            // See transformPastedText for part 1
            let nodes = [];
            slice.content.forEach((node) => {
                // Nodes in slice.content are split by enter
                // Create a paragraph with each node within this line
                var newNode;
                if (node && node.type && node.type.name == "image") {
                    // This is when a pure image is being pasted
                    newNode = node;
                } else if (node.content.content && node.content.content[0] && node.content.content[0].type.name == "image") {
                    // When a line of pasted text is an image
                    newNode = node.content.content[0];
                } else {
                    let lineText = node.textContent;

                    // zero-width space added to make sure empty lines appear on paste
                    // remove them
                    if (lineText.endsWith("\u8203")) {
                        lineText = lineText.substring(0, lineText.length - 1);
                    }
                    let ttf = textToFrag(lineText);
                    if (ttf && ttf[0] && ttf[0].type && (ttf[0].type.name === "image" || ttf[0].type.name === "codeBlock")) {
                        // Images and codeBlocks dont go into a paragraph
                        newNode = ttf[0];
                    } else {
                        newNode = schema.nodes.paragraph.create({}, Fragment.fromArray(ttf));
                    }
                }
                nodes.push(newNode);
            });

            let frag = Fragment.fromArray(nodes);

            return new Slice(frag, slice.openStart, slice.openEnd);
        }, 

        handlePaste(view, event, slice) {
            // Dont be doing any pasting when the user is trying to paste inside mathquill
            // cringe
            if (event.target.tagName === "TEXTAREA") {
                // This is a mathquill element
                return true; // true == dont paste
            }

            return false; // false == do paste ... what?
        },

        transformPastedText(text) {
            // Part 1 of pasting
            // See transformPasted for part 2
            // First add zero-width spaces to make sure empty lines count
            text = text.replaceAll(/\\begin\{align\**\}/g, "$\\begin{align}")
                       .replaceAll(/\\end\{align\**\}/g, "\\end{align}$");

            let lines = text.split("\n");
            
            for (var i = 0; i < lines.length; i++) {
                lines[i] += "\u8203";
            }

            return lines.join("\n");
        }
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
                        return; // This is temporary, I dont like leaving mq from the right
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
            nextFrame(() => {this.mathField.focus()});
        }

        // Realign element after pasting latex
        nextFrame(() => {verticalAlign(this.dom);});

        // Event handlers
        this.dom.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.dom.querySelector('textarea').addEventListener('blur', (e) => this.handleBlur());
        this.dom.addEventListener('paste', (e) => this.handlePaste(e));
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
        } else if ((event.key === "+" || event.key === "=") && ctrlKey(event) && event.shiftKey) {
            //                                      ^ for macOS lol
            event.preventDefault();

            evaluateSympy(this.mathField, this.dom);
        } else if (event.key === "Enter") {
            // Enter should do nothing inside mathquill elements
            event.preventDefault();
        } else if (ctrlKey(event) && event.shiftKey && event.key === "B") {
            event.preventDefault();
            this.mathField.cmd("\\vecf");
        } else if (ctrlKey(event) && event.key === "b") {
            event.preventDefault();
            this.mathField.cmd("\\vect");
        } else if (event.key === "&") {
            event.preventDefault();
            this.mathField.cmd("\\aligned");
        } else if (ctrlKey(event) && event.key == "p") {
            // Download mathquill screenshot
            event.preventDefault();
            downloadMathQuillScreenShot(this.dom);
        }
        
        else {
            // Vertical align when new key entered
            nextFrame(() => {verticalAlign(this.dom);});
        }
    }

    handleBlur() {
        // Save latex in latex field when leaving mathquill
        // When mathquill object resets, it needs latex to render again
        const latex = this.mathField.latex();

        // Search for my node and set the new latex
        // Mathquill node may no longer exist (ex. ctrl+z on element)
        // In that case, we want to focus where we were before
        const pos = this.getPos();
        if (pos !== undefined) {
            const tr = editor.state.tr.setNodeMarkup(pos, null, {latex: latex});
            editor.dispatch(tr);
        } else {
            // node no longer exists, focus where it used to be
            editor.focus();
        }
    }

    handlePaste(e) {
        // Manually write pasted text
        // This is a necessary workaround for prosemirror cancelling paste event
        this.mathField.write(e.clipboardData.getData("text"));
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

function placeMathQuillNodeAtSelection() {
    // Very similar to above, but for button use instead
    // Define the new node
    // initialize = true to focus on creation
    const mathquillNode = schema.nodes.mathquill.create({initialize: true});

    // Get selection
    const pos = editor.state.selection.$anchor.pos;

    // Commit to prosemirror
    const transaction = editor.state.tr.replaceRangeWith(pos, pos, mathquillNode);
    editor.dispatch(transaction);
}

function exitCurrentMathQuillNode() {
    // Another version of exiting mathquill node for use from toggle button

    // Select after the node
    const pos = editor.state.selection.$anchor.pos;
    let tr = editor.state.tr;
    let selection = TextSelection.create(tr.doc, pos);
    editor.dispatch(tr.setSelection(selection).scrollIntoView());
    editor.focus();
}

// Convert to plugin for prosemirror
const mathQuillInputRule = inputRules({
    rules: [insertMathQuillRule()],
});

function refreshHighlights() {
    // Handle visible highlighting of mathquill nodes

    // Unhighlight all highlighted nodes
    const highlighted = [...document.getElementsByClassName("highlighted")];
    for (var i = 0; i < highlighted.length; i++) {
        highlighted[i].classList.remove("highlighted");
    }

    // Check if the selection contains mathquill
    const { from, to } = editor.state.selection;
    editor.state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name === "mathquill") {
            // Highlight me!
            editor.nodeDOM(pos).classList.add("highlighted");
        }
    })
}

function scrollCursorIntoView() {
    // If in a mathquill element, scroll if cursor moves (this is called during keydown in main.js)
    const cursor = document.querySelector('.mq-cursor');

    if (!cursor) {
        // There is no cursor silly!
        return;
    }

    // Place parent element completely in view
    const cursorParent = cursor.parentElement;
    if (!cursorParent) {
        console.log('Cursor parent element not found');
        return;
    }

    // Get bounding rectangle
    const cursorParentRect = cursorParent.getBoundingClientRect();
    
    // Check for vertical overflow
    const isTopOverflow = cursorParentRect.top < 0;
    const isBottomOverflow = cursorParentRect.bottom > window.innerHeight;

    if (isTopOverflow || isBottomOverflow) {
        console.log('Scrolling to mq-cursor');
        
        cursorParent.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
    }
}

function downloadMathQuillScreenShot(mathQuillElement) {
    // Download a screenshot of the mathquill canvas given mathquill element

    // Get the bounding box of the MathQuill element
    const rect = mathQuillElement.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);

    // Create a canvas
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // Set background to transparent
    ctx.clearRect(0, 0, width, height);

    // Remove cursor from image
    let cursor_element = document.querySelector(".mq-cursor");
    cursor_element.classList.add("mq-blink");
    
    // Unfocus so we dont get borders around element and in align/matrices
    mathQuillElement.classList.remove("mq-focused");

    // Set color to black
    mathQuillElement.classList.add("screenshotting");

    // Convert the MathQuill element into an image
    html2canvas(mathQuillElement, {
        backgroundColor: null, // Transparent background
        scale: 2, // Higher resolution
        useCORS: true
    }).then(canvas => {
        // Convert to PNG and trigger download
        canvas.toBlob(function (blob) {
            // Write blob to clipboard
            navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob
                })
            ]);

            // Create URL for downloading
            const pngUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = pngUrl;
            a.download = "mathquill.png";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(pngUrl);

            // Refocus and revert color!
            mathQuillElement.classList.add("mq-focused");
            mathQuillElement.classList.remove("screenshotting");
        }, "image/png");
    }).catch(error => {
        console.error("Error capturing MathQuill element:", error);
    });
}

let mathButton = document.getElementById("create-math-button");

mathButton.addEventListener('mousedown', (event) => {
    event.preventDefault(); // Dont lose focus on editor
    if (document.activeElement.tagName == "TEXTAREA") {
        // We are in a mathquill element, get out
        exitCurrentMathQuillNode();
    } else {
        // Create a new mathquill element and focus!
        placeMathQuillNodeAtSelection();
    }
});

let clearSympyButton = document.getElementById("clear-sympy");

clearSympyButton.addEventListener('mousedown', (event) => {
    loadPyScript().then(() => {
        clear_sympy();
    });
});

function evaluateSympy(mathField, dom) {
    // Evaluate sympy on current mathfield, also given corresponding dom element

    // Take current latex, pass to sympy, and get result
    let latex = mathField.latex();

    // Move to right end. If it ends with =, we dont want it, so remove
    mathField.moveToRightEnd();
    if (latex.endsWith("=")) {
        mathField.keystroke("Backspace");
        latex = latex.substring(0, latex.length - 1);
    }

    // We must wait for pyscript to be done
    // First, write some dots
    mathField.write("\\dots");

    loadPyScript().then(() => {
        // Erase the dots
        mathField.keystroke("Backspace");

        try {
            const result = sympify(latex);

            if (latex.includes("\\gets")) {
                // This is an assignment. Just write a check at the end
                mathField.write("\\checkmark");
            } else {
                // Type out the result
                mathField.write("=" + result);
            }

            // Make field green
            dom.style.backgroundColor = "rgb(189, 255, 192)";
        } catch (error) {
            // Something bad happened. Make field red. 
            dom.style.backgroundColor = "rgb(255, 189, 189)";

            console.error(error);
        }

        // Restore color after 3 seconds
        setTimeout(() => {dom.style.backgroundColor = ""}, 3000);
    })
}

let evalSympyButton = document.getElementById("eval-sympy");

evalSympyButton.addEventListener("mousedown", (event) => {
    event.preventDefault(); // Do not lose focus from mathquill element

    try {
        // First, get mathquill element
        const mathquillElement = document.activeElement.parentElement.parentElement;

        if (mathquillElement && mathquillElement.tagName == "SPAN") {
            // We assume this is a mathquill element
            evaluateSympy(MQ(mathquillElement), mathquillElement);
        }
    } catch(_) {}
})

let screenshotMathButton = document.getElementById("screenshot-math");

screenshotMathButton.addEventListener('mousedown', (event) => {
    event.preventDefault(); // Do not lose focus from mathquill element

    try {
        // First, get mathquill element
        const mathquillElement = document.activeElement.parentElement.parentElement;

        if (mathquillElement && mathquillElement.tagName == "SPAN") {
            // We assume this is a mathquill element
            downloadMathQuillScreenShot(mathquillElement);
        }
    } catch(_) {}
});

function createAlignEnvironment() {
    let deepestElement = getDeepestElementAtSelection();

    // This procedure places the selection in an empty line between text to the left and right, if exists
    if (deepestElement.tagName != "BR") {
        // We have stuff on this line. Press enter, and move back up
        simulateKeyPress("Enter");
        cursorOffset(-2);
        deepestElement = getDeepestElementAtSelection();
    }

    if (deepestElement.tagName != "BR") {
        // There was stuff before the cursor. Go back to next line
        cursorOffset(2);
        deepestElement = getDeepestElementAtSelection();
    }

    if (deepestElement.tagName != "BR") {
        // When we clicked enter, some stuff moved with us. Click enter and then up to get a free line
        simulateKeyPress("Enter");
        cursorOffset(-2);
    }

    // Now, create an element, get the controller, and execute align
    placeMathQuillNodeAtSelection();

    nextFrame(() => {
        const mathField = MQ(document.activeElement.parentElement.parentElement);
        mathField.cmd("\\align");
    })
}

let alignButton = document.getElementById("create-align");

alignButton.addEventListener("mousedown", (event) => {
    event.preventDefault(); // Do not lose focus from mathquill element
    
    createAlignEnvironment();
})