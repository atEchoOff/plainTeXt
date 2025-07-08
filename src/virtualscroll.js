// On initial load, make content-visible: auto to enable virtual scroll. 
function loadVirtualScroll() {
    if (openingFile) {
        // There may be pasted elements outside the viewable window. Scroll all the way down first.
        openingFile = false;

        const scrollHeight = editorElement.scrollHeight;

        editorElement.scrollTo({
            top: scrollHeight,
            behavior: 'smooth'
        });

        nextFrame(loadVirtualScroll);
        return;
    }

    const state = editor.state;
    const tr = state.tr;
    let wasModified = false;

    // Iterate over every node in the document with its position
    state.doc.descendants((node, pos) => {
        // Check if the node is a paragraph and has a class
        if (node.type.name === 'paragraph' && node.attrs.class) {
            // Use object destructuring to create a new attributes object
            // that includes everything EXCEPT the class property
            const { class: _, ...rest } = node.attrs;

            // Apply the change
            tr.setNodeMarkup(pos, undefined, rest);
            wasModified = true;
        }
    });

    if (wasModified) {
        editor.dispatch(tr);
    }
}