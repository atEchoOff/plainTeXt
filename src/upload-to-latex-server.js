async function compileLatex(fullBlob, serverUrl) {
    const CHUNK_SIZE = 50 * 1024 * 1024; // 50mb
    const uploadId = "plaintext" + crypto.randomUUID();

    // Show the user what is going on
    const loaderElement = document.createElement("div");
    loaderElement.innerText = ".zip file is being created...";
    loaderElement.classList.add("py-script-loader");

    document.body.appendChild(loaderElement);

    // Create and upload chunks to server
    const chunkPromises = [];
    for (let start = 0; start < fullBlob.size; start += CHUNK_SIZE) {
        const chunk = fullBlob.slice(start, start + CHUNK_SIZE);
        const uploadUrl = `${serverUrl}?action=upload&upload_id=${uploadId}`;
        
        loaderElement.innerText += `\nUploading chunk from byte ${start} to ${start + chunk.size}...`;

        const promise = fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
            },
            body: chunk,
        });
        chunkPromises.push(promise);
    }

    // Wait for all chunks to be uploaded
    const uploadResponses = await Promise.all(chunkPromises);

    // Check if any chunk upload failed
    for (const response of uploadResponses) {
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Chunk upload failed: ${response.status} ${errorText}`);
        }
    }
    
    loaderElement.innerText += '\nAll chunks uploaded successfully. Compiling...';

    // 3. Send the final "compile" request
    const compileUrl = `${serverUrl}?action=compile&upload_id=${uploadId}`;
    const compileResponse = await fetch(compileUrl, {
        method: 'POST',
    });

    if (!compileResponse.ok) {
        const errorText = await compileResponse.text();
        throw new Error(`Compilation failed: ${errorText}`);
    }

    loaderElement.remove();
    
    // 4. Return the resulting PDF as a Blob
    return compileResponse.blob();
}