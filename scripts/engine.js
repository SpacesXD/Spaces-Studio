async function startConversion(file, isH, statusElement) {
    const log = (m) => { 
        statusElement.innerHTML += "> " + m + "<br>"; 
        statusElement.scrollTop = statusElement.scrollHeight; 
    };

    const BLOCK_MAP = {
        "event_whenflagclicked": "WhenProgramStartBrick",
        "event_whenthisspriteclicked": "WhenTappedBrick",
        "event_whenbroadcastreceived": "BroadcastReceiverBrick",
        "event_broadcast": "BroadcastBrick",
        "motion_movesteps": "MoveNStepsBrick",
        "motion_gotoxy": "PlaceAtBrick",
        "looks_nextcostume": "NextLookBrick",
        "looks_show": "ShowBrick",
        "looks_hide": "HideBrick",
        "control_wait": "WaitBrick",
        "control_forever": "ForeverBrick"
    };

    const XML_URL = "https://raw.githubusercontent.com/SpacesXD/Spaces-Studio/refs/heads/main/XMLBase.xml";

    log("Descargando base de Spaces Studio...");
    let baseXml = "";
    try {
        const resp = await fetch(XML_URL);
        baseXml = await resp.text();
    } catch (e) {
        log("Error cargando base.");
        return;
    }

    const sb3Zip = new JSZip();
    const catZip = new JSZip();
    const sceneName = "Escena"; // Carpeta raíz requerida por Pocket Code

    try {
        const sb3Data = await sb3Zip.loadAsync(file);
        const project = JSON.parse(await sb3Data.file("project.json").async("string"));

        log("Limpiando y preparando XML...");
        // Preparamos el Header
        let header = baseXml.split("<objectList")[0];
        let footer = baseXml.split("</objectList>")[1] || "</scene></scenes></program>";

        // Ajustes de pantalla
        header = header.replace(/<landscapeMode>.*?<\/landscapeMode>/g, `<landscapeMode>${isH}</landscapeMode>`)
                       .replace(/<screenHeight>.*?<\/screenHeight>/g, `<screenHeight>${isH ? 720 : 1476}</screenHeight>`)
                       .replace(/<screenWidth>.*?<\/screenWidth>/g, `<screenWidth>${isH ? 1476 : 720}</screenWidth>`)
                       .replace(/<programName>.*?<\/programName>/g, `<programName>${file.name.replace(".sb3","")}</programName>`);

        let objectListContent = "";

        for (const target of project.targets) {
            const name = target.isStage ? "Fondo" : target.name;
            log("Exportando: " + name);

            objectListContent += `\n<object type="Sprite" name="${name}">`;
            
            // --- PROCESAR APARIENCIAS ---
            objectListContent += `<lookList>`;
            for (const costume of target.costumes) {
                let fName = costume.md5ext;
                const fileData = await sb3Data.file(fName).async("blob");
                
                if (fName.endsWith('.svg')) {
                    // Convertir SVG a PNG porque Catrobat nativo a veces falla con SVGs de Scratch
                    const svgText = await fileData.text();
                    const pngBlob = await svgToPng(svgText, isH);
                    fName = fName.replace(".svg", ".png");
                    catZip.file(`${sceneName}/images/${fName}`, pngBlob);
                } else {
                    catZip.file(`${sceneName}/images/${fName}`, fileData);
                }
                objectListContent += `<look name="${costume.name}"><fileName>${fName}</fileName></look>`;
            }
            objectListContent += `</lookList>`;

            // --- PROCESAR SONIDOS (CORREGIDO) ---
            objectListContent += `<soundList>`;
            for (const snd of target.sounds) {
                const sndData = await sb3Data.file(snd.md5ext).async("blob");
                // IMPORTANTE: Los sonidos van en Escena/sounds/
                catZip.file(`${sceneName}/sounds/${snd.md5ext}`, sndData);
                objectListContent += `<sound><fileName>${snd.md5ext}</fileName><name>${snd.name}</name></sound>`;
                log("  + Sonido: " + snd.name);
            }
            objectListContent += `</soundList>`;

            // --- PROCESAR BLOQUES ---
            objectListContent += `<scriptList>`;
            const bks = target.blocks;
            for (const id in bks) {
                const b = bks[id];
                if (BLOCK_MAP[b.opcode] && (b.opcode.startsWith('event_when') || !b.parent)) {
                    objectListContent += `<script type="${BLOCK_MAP[b.opcode]}"><brickList>`;
                    let next = b.next;
                    while(next && bks[next]) {
                        if(BLOCK_MAP[bks[next].opcode]) {
                            objectListContent += `<brick type="${BLOCK_MAP[bks[next].opcode]}"></brick>`;
                        }
                        next = bks[next].next;
                    }
                    objectListContent += `</brickList></script>`;
                }
            }
            objectListContent += `</scriptList><nfcTagList/><userVariables/><userLists/><userDefinedBrickList/></object>`;
        }

        // Construcción final del code.xml
        const finalXml = header + "<objectList>" + objectListContent + "</objectList>" + footer;
        catZip.file("code.xml", finalXml);

        log("Generando archivo .catrobat...");
        const content = await catZip.generateAsync({type: "blob"});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = file.name.replace(".sb3", ".catrobat");
        link.click();
        log("¡LISTO! Revisa tu carpeta de descargas.");

    } catch (err) {
        log("ERROR: " + err.message);
        console.error(err);
    }
}

async function svgToPng(svg, isH) {
    return new Promise((res) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
        img.onload = () => {
            canvas.width = isH ? 1476 : 960;
            canvas.height = 720;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob(res, 'image/png');
        };
        img.src = url;
    });
}
