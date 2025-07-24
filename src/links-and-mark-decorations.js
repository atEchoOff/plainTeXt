function generateEqrefDictionaries() {
    // Scan through page, return dictionaries matching string labels to their anchor elements.
    const labels = document.querySelectorAll(".mq-label, .label");
    const sections = document.querySelectorAll("h2, h3");
    const theorems = document.querySelectorAll(".theorem");

    let tryLabels = {};
    let trySections = {};
    let tryTheorems = {};

    for (let label of labels) {
        tryLabels[label.innerHTML.replaceAll("\u200b", "")] = label;
    }

    for (let section of sections) {
        trySections[section.innerHTML.replaceAll("\u200b", "")] = section;
    }

    for (let theorem of theorems) {
        tryTheorems[theorem.innerHTML.replaceAll("\u200b", "")] = theorem;
    }

    return [tryLabels, trySections, tryTheorems];
}

function generateCitationDictionaries() {
    // Scan through page, return dictionaries matching string citations to their anchor elements/links.
    // Return a list of:
    // Return ["element", element] if a bibtex element should be linked to
    // Return ["link", linkString] if a link should be followed
    let tryCitation = {};

    // Get all bibtex
    const bibtexes = document.querySelectorAll("div[data-language='BibTeX']");
    for (var bibtex of bibtexes) {
        // Go through prosemirror because codemirror hides its code from innerText sometimes
        const bibtexEntries = CodeMirror.findFromDOM(bibtex).viewState.state.doc.toString().split("@");
        // Loop through this bibtext's entries:
        for (var entry of bibtexEntries) {
            const articleName = entry.substring(entry.indexOf("{") + 1, entry.indexOf(","));
            if (entry.includes("url")) {
                // Get the url line
                let url = entry.substring(entry.indexOf("url") + 3);
                url = url.substring(url.indexOf("{") + 1, url.indexOf("}"));

                // url should contain the exact url since urls cant contain { or }
                tryCitation[articleName] = ["link", url];
            } else {
                // There is no url... so instead just scroll this bibtex into view
                tryCitation[articleName] = ["element", bibtex];
            }
        }
    }

    return tryCitation;
}

function matchingLabel(reference, tryLabels, trySections, tryTheorems) {
    // Return an element which can be linked to from a eqref, by priority
    // Use existing dictionaries if they exist
    const searchText = reference.replaceAll("\u200b", ""); // silly mathquill, no zero-width spaces please!

    if (!tryLabels || !trySections || !tryTheorems) {
        [tryLabels, trySections, tryTheorems] = generateEqrefDictionaries();
    }

    if (searchText in tryLabels) {
        return tryLabels[searchText];
    }

    if (searchText in trySections) {
        return trySections[searchText];
    }

    if (searchText in tryTheorems) {
        return tryTheorems[searchText];
    }

    // We found nothing
    return null;
}

function matchingCitation(citation, tryCitations) {
    // Return matching citation as follows:
    // Return ["element", element] if a bibtex element should be linked to
    // Return ["link", linkString] if a link should be followed
    // Use existing dictionaries if they exist

    if (!tryCitations) {
        tryCitations = generateCitationDictionaries();
    }

    const searchText = citation.replaceAll("\u200b", ""); // silly mathquill, no zero-width spaces please!

    if (searchText in tryCitations) {
        return tryCitations[searchText];
    }

    // Nothing found
    return [null, null];
}

function isUnlinked(element, tryLabels, trySections, tryTheorems, tryCitations, textOverride) {
    // Check if a citation or reference is unlinked
    // Pass (potential) dictionaries to matchingLabel/matchingCitation.
    // If textOverride, apply textOverride as innerHTML instead. Useful for comma separated links

    const innerText = textOverride ? textOverride : element.innerHTML;

    if (innerText.includes(",")) {
        // Return unlinked if ANY element is unlinked
        return innerText.split(",").some((individualLink) => {
            return isUnlinked(element, tryLabels, trySections, tryTheorems, tryCitations, individualLink.trim())
        });
    }

    if (element.classList.contains("reference") && !element.classList.contains("label")) {
        // Check for available references
        const match = matchingLabel(innerText, tryLabels, trySections, tryTheorems);
        
        return !match;
    } else if (element.classList.contains("citation")) {
        const [a, b] = matchingCitation(innerText, tryCitations);

        return !a;
    }

    return false;
}

function decorateLinkedMarks() {
    // Check all eqrefs and citations for existing links, and decorate

    // Pregenerate dictionaries for efficiency
    let [tryLabels, trySections, tryTheorems] = generateEqrefDictionaries();
    let tryCitations = generateCitationDictionaries();

    document.querySelectorAll(".reference:not(.label), .citation").forEach((referenceOrCitation) => {
        decorateMark(referenceOrCitation, true, tryLabels, trySections, tryTheorems, tryCitations);
    });
}

// Valid tagNames for mark tags (FIXME this needs changing if a mark tag changes...)
const markTags = new Set(["H2", "H3", "CODE", "EM", "STRONG", "A"]);

function decorateMark(element, checkLinks, tryLabels, trySections, tryTheorems, tryCitations) {
    // If dictionaries exist, this is just for linking/unlinking, so ignore selection stuff.
    // If checkLinks, also check if it should be linked
    if (element) {
        // First, unselect selected elements (copy so that .remove() doesnt mess up loop)
        if (!tryLabels) {
            const selectedElements = [...document.getElementsByClassName("selected-mark")];
            for (let selectedElement of selectedElements) {
                // If the mark has *just* a zero width space, it is invisible and unusable. Delete it!
                if (element !== selectedElement && selectedElement.innerText == "\u200b") {
                    selectedElement.remove();
                } else if (element !== selectedElement) {
                    selectedElement.classList.remove("selected-mark");
                }
            }
        }

        // Select selected element (only if editor.state.storedMarks is null i.e. we are in a mark)
        if (markTags.has(element.tagName) && !!!editor.state.storedMarks) {
            let addUnlinked = false;

            if (checkLinks) {
                // Check if this should be decorated as unlinked
                addUnlinked = isUnlinked(element, tryLabels, trySections, tryTheorems, tryCitations);
            }

            nextFrame(() => {
                if (checkLinks && addUnlinked) {
                    element.classList.add("unlinked-mark");
                } else if (checkLinks && !addUnlinked) {
                    element.classList.remove("unlinked-mark");
                }

                if (!tryLabels) {
                    element.classList.add("selected-mark");
                }
            })
        }
    }
}

// Save whether or not we want to create a new (empty) mark tag
let createNewMark = false;

function decorateAndCreateIfNeeded(checkLinks) {
    // Decorate the current element, place in zero width space to make it visible
    const element = getDeepestElementAtSelection();
    decorateMark(element, checkLinks);

    if (createNewMark && editor.state.storedMarks && editor.state.storedMarks.length == 1) {
        // This happens when a mark is triggered by prosemirror. However, it doesnt create a tag
        // Since we want decorations, this force creates the tag
        typeText("\u200b");
        nextFrame(() => {decorateMark(getDeepestElementAtSelection(), checkLinks);});
        createNewMark = false;
    }
}

document.addEventListener('click', (event) => {
    if (ctrlKey(event) && event.target.classList.contains('reference')) {
        // Handle moving to label for reference
        const match = matchingLabel(event.target.innerHTML);

        if (match) {
            // We have a label, scroll to it!
            match.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
        }
    } else if (ctrlKey(event) && event.target.classList.contains('citation')) {
        const [linkType, value] = matchingCitation(event.target.innerHTML);

        if (linkType === "link") {
            // Jump to link!
            window.open(value, '_blank').focus();
        } else if (linkType === "element") {
            // Scroll to element
            value.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
        }
    } else {
        // This is just a click, handle mark decorations
        nextFrame(() => {decorateMark(getDeepestElementAtSelection());});
    }
})

function noSingleZeroWidthSpaces(state, dispatch) {
    // If we are backspacing into a zero width space for a mark, delete the mark
    const currentElement = getDeepestElementAtSelection();
    if (currentElement && currentElement.innerText == "\u200b") {
        
        let tr = state.tr;
        let curpos = state.selection.$head.pos;

        tr = tr.delete(curpos - 1, curpos);
        tr = tr.setStoredMarks([]);
        dispatch(tr);
        return true;
    }
}