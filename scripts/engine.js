async function startConversion(file, isH, statusElement) {
    const log = (m) => { 
        statusElement.innerHTML += "> " + m + "<br>"; 
        statusElement.scrollTop = statusElement.scrollHeight; 
    };

    // MAPA DE BLOQUES AMPLIADO (Scratch ID -> Catrobat Brick)
    const BLOCK_MAP = {
        // Eventos
        "event_whenflagclicked": "WhenProgramStartBrick",
        "event_whenthisspriteclicked": "WhenTappedBrick",
        "event_whenbroadcastreceived": "BroadcastReceiverBrick",
        "event_broadcast": "BroadcastBrick",
        "event_broadcastandwait": "BroadcastWaitBrick",
        
        // Movimiento
        "motion_movesteps": "MoveNStepsBrick",
        "motion_turnright": "TurnRightBrick",
        "motion_turnleft": "TurnLeftBrick",
        "motion_gotoxy": "PlaceAtBrick",
        "motion_glideto": "GlideToBrick",
        "motion_changexby": "ChangeXByNBrick",
        "motion_setx": "SetXBrick",
        "motion_changeyby": "ChangeYByNBrick",
        "motion_sety": "SetYBrick",
        "motion_pointindirection": "PointInDirectionBrick",
        "motion_ifonedgebounce": "IfOnEdgeBounceBrick",
        
        // Apariencia
        "looks_sayforsecs": "SayForBrick",
        "looks_say": "SayBubbleBrick",
        "looks_switchcostumeto": "SetLookBrick",
        "looks_nextcostume": "NextLookBrick",
        "looks_switchbackdropto": "SetBackdropBrick",
        "looks_changesizeby": "ChangeSizeByNBrick",
        "looks_setsizeto": "SetSizeToBrick",
        "looks_show": "ShowBrick",
        "looks_hide": "HideBrick",
        "looks_gotofrontback": "ComeToFrontBrick",
        
        // Sonido
        "sound_playuntildone": "PlaySoundWaitBrick",
        "sound_play": "PlaySoundBrick",
        "sound_stopallsounds": "StopAllSoundsBrick",
        
        // Control
        "control_wait": "WaitBrick",
        "control_repeat": "RepeatBrick",
        "control_forever": "ForeverBrick",
        "control_if": "IfLogicBeginBrick",
        "control_if_else": "IfThenElseBrick",
        "control_stop": "StopScriptBrick",
        "control_start_as_clone": "WhenCloneStartedBrick",
        "control_create_clone_of": "CloneBrick",
        "control_delete_this_clone": "DeleteThisCloneBrick"
    };

    const XML_URL = "https://raw.githubusercontent.com/SpacesXD/Spaces-Studio/refs/heads/main/XMLBase.xml";

    log("Descargando base XML...");
    let baseXml = "";
    try {
        const resp = await fetch(XML_URL);
        baseXml = await resp.text();
    } catch (e) {
        log("Error: No se pudo conectar con la base de GitHub.");
        return;
    }

    const sb3Zip = new JSZip();
    const catZip = new JSZip();
    const sceneName = "Escena";

    try {
        const sb3Data = await sb3Zip.loadAsync(file);
        const project = JSON.parse(await sb3Data.file("project.json").async("string"));

        // 1. Configurar Header según el modo seleccionado
        let finalXml = baseXml
            .replace(/<landscapeMode>.*?<\/landscapeMode>/, `<landscapeMode>${isH}</landscapeMode>`)
            .replace(/<screenHeight>.*?<\/screenHeight>/, `<screenHeight>${isH ? 720 : 1476}</screenHeight>`)
            .replace(/<screenWidth>.*?<\/screenWidth>/, `<screenWidth>${isH ? 1476 : 720}</screenWidth>`)
            .replace(/<programName>.*?<\/programName>/, `<programName>${file.name.replace(".sb3", "")}</programName>`);

        let objectListXml = "";

        // 2. Procesar cada Objeto (Sprite)
        for (const target of project.targets) {
            const name = target.isStage ? "Fondo" : target.name;
            log("Procesando objeto: " + name);

            objectListXml += `\n        <object type="Sprite" name="${name}">`;
            
            // ASPECTOS (Looks)
            objectListXml += `\n          <lookList>`;
            for (const costume of target.costumes) {
                let fName = costume.md5ext;
                if (fName.endsWith('.svg')) {
                    const svg = await sb3Data.file(fName).async("string");
                    const png = await svgToPng(svg, isH);
                    fName = fName.replace(".svg", ".png");
                    catZip.file(`${sceneName}/images/${fName}`, png);
                } else {
                    const imgData = await sb3Data.file(fName).async("blob");
                    catZip.file(`${sceneName}/images/${fName}`, imgData);
                }
                objectListXml += `\n            <look name="${costume.name}"><fileName>${fName}</fileName></look>`;
            }
            objectListXml += `\n          </lookList>`;

            // SONIDOS
            objectListXml += `\n          <soundList>`;
            for (const snd of target.sounds) {
                const sndData = await sb3Data.file(snd.md5ext).async("blob");
                catZip.file(`${sceneName}/sounds/${snd.md5ext}`, sndData);
                objectListXml += `\n            <sound><fileName>${snd.md5ext}</fileName><name>${snd.name}</name></sound>`;
            }
            objectListXml += `\n          </soundList>`;

            // BLOQUES (Scripts)
            objectListXml += `\n          <scriptList>`;
            const blocks = target.blocks;
            for (const id in blocks) {
                const b = blocks[id];
                // Solo iniciamos scripts desde eventos o bloques sueltos
                if (BLOCK_MAP[b.opcode] && (b.opcode.startsWith('event_when') || !b.parent)) {
                    objectListXml += `\n            <script type="${BLOCK_MAP[b.opcode]}">`;
                    objectListXml += `\n              <brickList>`;
                    
                    let nextId = b.next;
                    while (nextId && blocks[nextId]) {
                        const nb = blocks[nextId];
                        if (BLOCK_MAP[nb.opcode]) {
                            objectListXml += `\n                <brick type="${BLOCK_MAP[nb.opcode]}"></brick>`;
                        }
                        nextId = nb.next;
                    }
                    objectListXml += `\n              </brickList>\n            </script>`;
                }
            }
            objectListXml += `\n          </scriptList>`;
            
            objectListXml += `\n          <nfcTagList/><userVariables/><userLists/><userDefinedBrickList/>\n        </object>`;
        }

        // 3. Inyectar todo en la base
        finalXml = finalXml.replace("<objectList/>", `<objectList>${objectListXml}\n      </objectList>`);
        finalXml = finalXml.replace("<objectList></objectList>", `<objectList>${objectListXml}\n      </objectList>`);

        // 4. Generar el ZIP final (.catrobat)
        catZip.file("code.xml", finalXml);
        const content = await catZip.generateAsync({type: "blob"});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = file.name.replace(".sb3", ".catrobat");
        link.click();
        log("¡CONVERSIÓN FINALIZADA!");

    } catch (err) {
        log("ERROR CRÍTICO: " + err.message);
        console.error(err);
    }
}

// Función auxiliar para convertir SVG de Scratch a PNG (Catrobat no usa SVG directo bien)
async function svgToPng(svg, isH) {
    return new Promise((resolve) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const blob = new Blob([svg], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            canvas.width = isH ? 1476 : 960;
            canvas.height = 720;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob(resolve, 'image/png');
        };
        img.src = url;
    });
            }
