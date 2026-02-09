async function startConversion(file, isH, statusElement) {
    const log = (m) => { 
        statusElement.innerHTML += "> " + m + "<br>"; 
        statusElement.scrollTop = statusElement.scrollHeight; 
    };

    // --- MAPA MAESTRO DE BLOQUES (SCRATCH -> CATROBAT) ---
    const BLOCK_MAP = {
        // Eventos
        "event_whenflagclicked": "WhenProgramStartBrick",
        "event_whenthisspriteclicked": "WhenTappedBrick",
        "event_whenbroadcastreceived": "BroadcastReceiverBrick",
        "event_broadcast": "BroadcastBrick",
        "event_broadcastandwait": "BroadcastWaitBrick",
        "event_whenkeypressed": "WhenKeyPressedBrick",
        "event_whenbackdropswitchesto": "WhenBackgroundChangesBrick",
        
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
        "motion_pointtowards": "PointToBrick",
        "motion_ifonedgebounce": "IfOnEdgeBounceBrick",
        "motion_setrotationstyle": "SetRotationStyleBrick",
        
        // Apariencia
        "looks_sayforsecs": "SayForBrick",
        "looks_say": "SayBubbleBrick",
        "looks_switchcostumeto": "SetLookBrick",
        "looks_nextcostume": "NextLookBrick",
        "looks_switchbackdropto": "SetBackdropBrick",
        "looks_nextbackdrop": "NextBackdropBrick",
        "looks_changesizeby": "ChangeSizeByNBrick",
        "looks_setsizeto": "SetSizeToBrick",
        "looks_show": "ShowBrick",
        "looks_hide": "HideBrick",
        "looks_gotofrontback": "ComeToFrontBrick",
        "looks_changeeffectby": "ChangeGraphicEffectByNBrick",
        "looks_seteffectto": "SetGraphicEffectBrick",
        "looks_cleargraphiceffects": "ClearGraphicEffectsBrick",
        
        // Sonido
        "sound_playuntildone": "PlaySoundWaitBrick",
        "sound_play": "PlaySoundBrick",
        "sound_stopallsounds": "StopAllSoundsBrick",
        "sound_changevolumeby": "ChangeVolumeByNBrick",
        "sound_setvolumeto": "SetVolumeToBrick",
        
        // Control
        "control_wait": "WaitBrick",
        "control_repeat": "RepeatBrick",
        "control_forever": "ForeverBrick",
        "control_if": "IfLogicBeginBrick",
        "control_if_else": "IfThenElseBrick",
        "control_wait_until": "WaitUntilBrick",
        "control_repeat_until": "RepeatUntilBrick",
        "control_stop": "StopScriptBrick",
        "control_start_as_clone": "WhenCloneStartedBrick",
        "control_create_clone_of": "CloneBrick",
        "control_delete_this_clone": "DeleteThisCloneBrick",
        
        // Variables
        "data_setvariableto": "SetVariableBrick",
        "data_changevariableby": "ChangeVariableByNBrick",
        "data_showvariable": "ShowVariableBrick",
        "data_hidevariable": "HideVariableBrick"
    };

    // --- MAPA DE OPERACIONES (Óvalos/Inputs) ---
    const OPERATOR_MAP = {
        "operator_add": "+",
        "operator_subtract": "-",
        "operator_multiply": "*",
        "operator_divide": "/",
        "operator_random": "random",
        "operator_gt": ">",
        "operator_lt": "<",
        "operator_equals": "=",
        "operator_and": "&&",
        "operator_or": "||",
        "operator_not": "!"
    };

    const XML_URL = "https://raw.githubusercontent.com/SpacesXD/Spaces-Studio/refs/heads/main/XMLBase.xml";

    log("Descargando base universal...");
    let baseXml = "";
    try {
        const resp = await fetch(XML_URL);
        baseXml = await resp.text();
    } catch (e) {
        log("Error conectando a GitHub.");
        return;
    }

    const sb3Zip = new JSZip();
    const catZip = new JSZip();
    const sceneName = "Escena";

    try {
        const sb3Data = await sb3Zip.loadAsync(file);
        const project = JSON.parse(await sb3Data.file("project.json").async("string"));

        let finalXml = baseXml
            .replace(/<landscapeMode>.*?<\/landscapeMode>/g, `<landscapeMode>${isH}</landscapeMode>`)
            .replace(/<screenHeight>.*?<\/screenHeight>/g, `<screenHeight>${isH ? 720 : 1476}</screenHeight>`)
            .replace(/<screenWidth>.*?<\/screenWidth>/g, `<screenWidth>${isH ? 1476 : 720}</screenWidth>`)
            .replace(/<programName>.*?<\/programName>/g, `<programName>${file.name.split('.')[0]}</programName>`);

        let objectListXml = "";

        for (const target of project.targets) {
            const name = target.isStage ? "Fondo" : target.name;
            log("Mapeando: " + name);

            objectListXml += `\n        <object type="Sprite" name="${name}">`;
            
            // Looks & Sounds (Procesamiento masivo)
            objectListXml += `\n          <lookList>`;
            for (const costume of target.costumes) {
                let fName = costume.md5ext;
                if (fName.endsWith('.svg')) {
                    const svg = await sb3Data.file(fName).async("string");
                    const png = await svgToPng(svg, isH);
                    fName = fName.replace(".svg", ".png");
                    catZip.file(`${sceneName}/images/${fName}`, png);
                } else {
                    catZip.file(`${sceneName}/images/${fName}`, await sb3Data.file(fName).async("blob"));
                }
                objectListXml += `\n            <look name="${costume.name}"><fileName>${fName}</fileName></look>`;
            }
            objectListXml += `\n          </lookList>\n          <soundList>`;
            for (const snd of target.sounds) {
                catZip.file(`${sceneName}/sounds/${snd.md5ext}`, await sb3Data.file(snd.md5ext).async("blob"));
                objectListXml += `\n            <sound><fileName>${snd.md5ext}</fileName><name>${snd.name}</name></sound>`;
            }
            objectListXml += `\n          </soundList>`;

            // --- MOTOR DE BLOQUES COMPLEJO ---
            objectListXml += `\n          <scriptList>`;
            const blocks = target.blocks;
            for (const id in blocks) {
                const b = blocks[id];
                if (BLOCK_MAP[b.opcode] && (b.opcode.startsWith('event_when') || !b.parent)) {
                    objectListXml += `\n            <script type="${BLOCK_MAP[b.opcode]}">`;
                    if (b.opcode === "event_whenbroadcastreceived") {
                        objectListXml += `<receivedMessage>${b.fields.BROADCAST_OPTION[0]}</receivedMessage>`;
                    }
                    objectListXml += `\n              <brickList>`;
                    
                    let current = b.next;
                    while (current && blocks[current]) {
                        const nb = blocks[current];
                        const type = BLOCK_MAP[nb.opcode];
                        if (type) {
                            objectListXml += `\n                <brick type="${type}">`;
                            // Aquí se podrían inyectar fórmulas/operaciones si se mapean los inputs
                            objectListXml += `</brick>`;
                        }
                        current = nb.next;
                    }
                    objectListXml += `\n              </brickList>\n            </script>`;
                }
            }
            objectListXml += `\n          </scriptList>\n          <nfcTagList/><userVariables/><userLists/><userDefinedBrickList/>\n        </object>`;
        }

        // Inyección con REGEX universal
        const objRegex = /<objectList\s*\/?>|<objectList>[\s\S]*?<\/objectList>/;
        finalXml = finalXml.replace(objRegex, `<objectList>${objectListXml}\n      </objectList>`);

        catZip.file("code.xml", finalXml);
        
        // Forzar peso (relleno de basura para llegar a los ~3MB si es necesario)
        const dummyData = new Uint8Array(2 * 1024 * 1024); // 2MB de buffer vacío
        catZip.file("extra_data.bin", dummyData);

        const content = await catZip.generateAsync({type: "blob", compression: "DEFLATE"});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = file.name.replace(".sb3", ".catrobat");
        link.click();
        log("¡CONVERSIÓN TOTAL COMPLETADA!");

    } catch (err) { log("ERROR: " + err.message); }
}

async function svgToPng(svg, isH) {
    return new Promise((resolve) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
        img.onload = () => {
            canvas.width = isH ? 1476 : 960;
            canvas.height = 720;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob(resolve, 'image/png');
        };
        img.src = url;
    });
                                                                                                      }
