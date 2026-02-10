async function startConversion(file, isH, statusElement) {
    const log = (m) => { 
        statusElement.innerHTML += "> " + m + "<br>"; 
        statusElement.scrollTop = statusElement.scrollHeight; 
    };

    // --- MAPA DE BLOQUES EXTENDIDO (SCRATCH -> CATROBAT) ---
    const BLOCK_MAP = {
        // Eventos (Events)
        "event_whenflagclicked": "WhenProgramStartBrick",
        "event_whenthisspriteclicked": "WhenTappedBrick",
        "event_whenbroadcastreceived": "BroadcastReceiverBrick",
        "event_broadcast": "BroadcastBrick",
        "event_broadcastandwait": "BroadcastWaitBrick",
        "event_whenkeypressed": "WhenKeyPressedBrick",
        "event_whenbackdropswitchesto": "WhenBackgroundChangesBrick",
        "event_whengreaterthan": "WhenConditionMetBrick",

        // Movimiento (Motion)
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

        // Apariencia (Looks)
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

        // Sonido (Sound)
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

        // Datos (Variables)
        "data_setvariableto": "SetVariableBrick",
        "data_changevariableby": "ChangeVariableByNBrick",
        "data_showvariable": "ShowVariableBrick",
        "data_hidevariable": "HideVariableBrick"
    };

    const XML_URL = "https://raw.githubusercontent.com/SpacesXD/Spaces-Studio/refs/heads/main/XMLBase.xml";

    log("Sincronizando con Spaces Studio Engine...");
    let baseXml = "";
    try {
        const resp = await fetch(XML_URL);
        baseXml = await resp.text();
    } catch (e) {
        log("ERROR FATAL: Base XML no encontrada.");
        return;
    }

    const sb3Zip = new JSZip();
    const catZip = new JSZip();
    const scene = "Escena";

    try {
        const data = await sb3Zip.loadAsync(file);
        const project = JSON.parse(await data.file("project.json").async("string"));

        let finalXml = baseXml
            .replace(/<landscapeMode>.*?<\/landscapeMode>/g, `<landscapeMode>${isH}</landscapeMode>`)
            .replace(/<screenHeight>.*?<\/screenHeight>/g, `<screenHeight>${isH ? 720 : 1476}</screenHeight>`)
            .replace(/<screenWidth>.*?<\/screenWidth>/g, `<screenWidth>${isH ? 1476 : 720}</screenWidth>`)
            .replace(/<programName>.*?<\/programName>/g, `<programName>${file.name.split('.')[0]}</programName>`);

        let objectsXml = "";

        for (const target of project.targets) {
            const name = target.isStage ? "Fondo" : target.name;
            log("Mapeando objeto: " + name);

            objectsXml += `\n<object type="Sprite" name="${name}">`;
            
            // Looks (Imágenes)
            objectsXml += `<lookList>`;
            for (const look of target.costumes) {
                const imgData = await data.file(look.md5ext).async("blob");
                catZip.file(`${scene}/images/${look.md5ext}`, imgData);
                objectsXml += `<look name="${look.name}"><fileName>${look.md5ext}</fileName></look>`;
            }
            objectsXml += `</lookList>`;

            // Sounds (Sonidos)
            objectsXml += `<soundList>`;
            for (const snd of target.sounds) {
                const sndData = await data.file(snd.md5ext).async("blob");
                catZip.file(`${scene}/sounds/${snd.md5ext}`, sndData);
                objectsXml += `<sound><fileName>${snd.md5ext}</fileName><name>${snd.name}</name></sound>`;
            }
            objectsXml += `</soundList>`;

            // Scripts (Lógica de Bloques)
            objectsXml += `<scriptList>`;
            const bks = target.blocks;
            for (const id in bks) {
                const b = bks[id];
                // Detectar inicio de pila de bloques
                if (BLOCK_MAP[b.opcode] && (b.opcode.startsWith('event_when') || !b.parent)) {
                    objectsXml += `<script type="${BLOCK_MAP[b.opcode]}"><brickList>`;
                    
                    let current = b.next;
                    while (current && bks[current]) {
                        const nb = bks[current];
                        if (BLOCK_MAP[nb.opcode]) {
                            objectsXml += `<brick type="${BLOCK_MAP[nb.opcode]}"></brick>`;
                        }
                        current = nb.next;
                    }
                    objectsXml += `</brickList></script>`;
                }
            }
            objectsXml += `</scriptList><nfcTagList/><userVariables/><userLists/><userDefinedBrickList/></object>`;
        }

        // Inyección forzada en la etiqueta objectList
        if (finalXml.includes("<objectList/>")) {
            finalXml = finalXml.replace("<objectList/>", `<objectList>${objectsXml}</objectList>`);
        } else {
            finalXml = finalXml.replace(/<objectList>[\s\S]*?<\/objectList>/, `<objectList>${objectsXml}</objectList>`);
        }

        catZip.file("code.xml", finalXml);
        
        const result = await catZip.generateAsync({type: "blob"});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(result);
        link.download = file.name.replace(".sb3", ".catrobat");
        link.click();
        log("¡CONVERSIÓN FINALIZADA!");

    } catch (err) {
        log("ERROR: " + err.message);
    }
}

async function svgToPng(svg, isH) {
    // Función mantenida por compatibilidad si decides usarla luego
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
