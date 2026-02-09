async function startConversion(file, isH, statusElement) {
    const log = (m) => { 
        statusElement.innerHTML += "> " + m + "<br>"; 
        statusElement.scrollTop = statusElement.scrollHeight; 
    };

    const BLOCK_MAP = {
        "event_whenflagclicked": "WhenProgramStartBrick",
        "event_whenthisspriteclicked": "WhenTappedBrick",
        "control_wait": "WaitBrick",
        "motion_movesteps": "MoveNStepsBrick",
        "looks_nextcostume": "NextLookBrick",
        "looks_show": "ShowBrick",
        "looks_hide": "HideBrick"
    };

    const XML_URL = "https://raw.githubusercontent.com/SpacesXD/Spaces-Studio/refs/heads/main/XMLBase.xml";

    log("Descargando base oficial...");
    let baseXml = "";
    try {
        const resp = await fetch(XML_URL);
        baseXml = await resp.text();
    } catch (e) {
        log("Error cargando base XML.");
        return;
    }

    const sb3Zip = new JSZip();
    const catZip = new JSZip();

    try {
        const data = await sb3Zip.loadAsync(file);
        const project = JSON.parse(await data.file("project.json").async("string"));

        // Ajustar el Header de tu base
        let finalXml = baseXml
            .replace("<landscapeMode>false</landscapeMode>", "<landscapeMode>" + isH + "</landscapeMode>")
            .replace("<screenHeight>1476</screenHeight>", "<screenHeight>" + (isH ? 720 : 1476) + "</screenHeight>")
            .replace("<screenWidth>720</screenWidth>", "<screenWidth>" + (isH ? 1476 : 720) + "</screenWidth>")
            .replace("<programName>Pocket Code</programName>", "<programName>" + file.name.split('.')[0] + "</programName>");

        let objMarkup = "";

        for (const target of project.targets) {
            const name = target.isStage ? "Fondo" : target.name;
            log("Procesando: " + name);

            objMarkup += '\n<object type="Sprite" name="' + name + '">';
            
            // Imágenes
            objMarkup += '<lookList>';
            for (const costume of target.costumes) {
                let fName = costume.md5ext;
                if (fName.endsWith('.svg')) {
                    const svg = await data.file(fName).async("string");
                    const imgUrl = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
                    const png = await new Promise(res => {
                        const img = new Image();
                        const canvas = document.createElement('canvas');
                        img.onload = () => {
                            canvas.width = isH ? 1476 : 960;
                            canvas.height = 720;
                            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                            URL.revokeObjectURL(imgUrl);
                            canvas.toBlob(res, 'image/png');
                        };
                        img.src = imgUrl;
                    });
                    fName = fName.replace(".svg", ".png");
                    catZip.file("Escena/images/" + fName, png);
                } else {
                    catZip.file("Escena/images/" + fName, await data.file(fName).async("blob"));
                }
                objMarkup += '<look name="' + costume.name + '"><fileName>' + fName + '</fileName></look>';
            }
            objMarkup += '</lookList>';

            // Bloques
            objMarkup += '<scriptList>';
            const bks = target.blocks;
            for (const id in bks) {
                const b = bks[id];
                if (BLOCK_MAP[b.opcode] && (b.opcode.startsWith('event_when') || !b.parent)) {
                    objMarkup += '<script type="' + BLOCK_MAP[b.opcode] + '"><brickList>';
                    let next = b.next;
                    while(next && bks[next]) {
                        if(BLOCK_MAP[bks[next].opcode]) objMarkup += '<brick type="' + BLOCK_MAP[bks[next].opcode] + '"></brick>';
                        next = bks[next].next;
                    }
                    objMarkup += '</brickList></script>';
                }
            }
            objMarkup += '</scriptList><nfcTagList/><userVariables/><userLists/><userDefinedBrickList/></object>';
        }

        // Inyección final
        finalXml = finalXml.replace("<objectList/>", "<objectList>" + objMarkup + "</objectList>");
        finalXml = finalXml.replace("<objectList></objectList>", "<objectList>" + objMarkup + "</objectList>");

        catZip.file("code.xml", finalXml);
        const content = await catZip.generateAsync({type: "blob"});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = file.name.replace(".sb3", ".catrobat");
        link.click();
        log("¡CONVERSIÓN EXITOSA!");

    } catch (err) {
        log("ERROR: " + err.message);
    }
                    }
