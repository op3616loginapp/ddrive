/* eslint-disable no-restricted-syntax,no-loop-func */
const table = document.getElementById('fm-table')
const tbody = document.getElementById('tbody')
const fileInput = document.getElementById('file-input')

const prevBtn = document.getElementById('previous-btn')

const createFolderBtn = document.getElementById('create-btn')
const uploadBtn = document.getElementById('upload-btn')

const trashBtn = document.getElementById('trash-btn')
const renameBtn = document.getElementById('rename-btn')

let currDirectory = ''
let parentDirectory = ''

//
// Utility functions
//
function makeid(length) {
    let result = ''
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const charactersLength = characters.length
    for (let i = 0; i < length; i += 1) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }

    return result
}

function download(url) {
    const a = document.createElement('a')
    a.href = url
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
}

//
// Helper functions
//
function clearTable() {
    while (tbody.hasChildNodes()) tbody.removeChild(tbody.lastChild)
}

function getSelected() {
    const [selected] = table.getElementsByClassName('selected')
    if (!selected) return undefined
    if (selected.classList.contains('file')) selected.type = 'file'
    else selected.type = 'folder'

    return selected
}

function resetBtns() {
    createFolderBtn.disabled = false
    uploadBtn.disabled = false
    const selected = getSelected()
    trashBtn.disabled = !selected
    renameBtn.disabled = !selected
}

function disableAllBtns() {
    createFolderBtn.disabled = true
    uploadBtn.disabled = true
    trashBtn.disabled = true
    renameBtn.disabled = true
}

//
// API Operations
//
async function refreshTable() {
    const resp = await fetch(`/api/directories/${currDirectory}`)
    const body = await resp.json()
    currDirectory = body.id
    parentDirectory = body.parentId
    prevBtn.disabled = !parentDirectory
    clearTable()
    resetBtns()
    for (const directory of body.child.directories) {
        tbody.appendChild(prepareFolderTR(directory))
    }
    for (const file of body.child.files) {
        tbody.appendChild(prepareFileTR(file))
    }
}

async function deleteFileOrFolder(type = 'file', id) {
    const url = `/api/${type === 'file' ? 'files' : 'directories'}/${id}`
    await fetch(url, { method: 'DELETE' })
    await refreshTable()
}

async function uploadFile() {
    for (const file of fileInput.files) {
        // Create unique id for progress bar
        const id = makeid(20)

        // Prepare form data and create progress bar
        const formData = new FormData()
        formData.append('file', file)
        createProgressBar(id, `Uploading ${file.name}`)

        // Create XHR request
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `/api/files/${currDirectory}`, true)

        // handle update progress
        xhr.upload.onprogress = (e) => {
            const progress = (e.total === 0) ? 0 : (e.loaded / e.total) * 100
            updateProgressBar(id, Math.floor(progress))
        }

        // Non 200 status handler
        xhr.onload = async () => {
            deleteProgressBar(id)
            await refreshTable()
        }

        // Network error handler
        xhr.onerror = async () => {
            deleteProgressBar(id)
            await refreshTable()
        }

        // Finally send data
        xhr.send(formData)
    }
}

async function navigatePrevFolder() {
    currDirectory = parentDirectory
    await refreshTable()
}

async function createFolder() {
    const id = makeid(20) // Temp id
    const input = createFolderTR(id)
    input.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            await fetch(`/api/directories`, {
                method: 'POST',
                body: JSON.stringify({ name: input.value, parentId: currDirectory }),
                headers: { 'Content-Type': 'application/json' },
            })
            await refreshTable()
        }
    })
    input.focus()
    disableAllBtns()
}

async function renameFileOrFolder() {
    const selected = getSelected()
    const inputText = document.createElement('input')
    inputText.style.height = '1rem'
    inputText.style.width = '80%'
    inputText.setAttribute('type', 'text')
    inputText.setAttribute('value', selected.textContent)
    selected.textContent = ''
    inputText.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            await fetch(`/api/${selected.type === 'file' ? 'files' : 'directories'}/${selected.id}`, {
                method: 'PUT',
                body: JSON.stringify({ name: inputText.value }),
                headers: { 'Content-Type': 'application/json' },
            })
            await refreshTable()
        }
    })
    selected.appendChild(inputText)
    inputText.focus()
    disableAllBtns()
}
//
// Event handlers
//
async function handleClick(e) {
    const selected = getSelected()
    if (selected && e.target.id === trashBtn.id) {
        await deleteFileOrFolder(selected.type, selected.id)
    }
    if (e.target.id === prevBtn.id && parentDirectory) {
        await navigatePrevFolder()
    }
    if (selected && e.target.id === renameBtn.id) {
        await renameFileOrFolder()
    }
    if (e.target.id === createFolderBtn.id) {
        await createFolder()
    }
    if (selected) {
        selected.classList.remove('selected')
        resetBtns()
    }
    const { classList } = e.target
    if (classList.contains('file') || classList.contains('folder')) {
        classList.add('selected')
        resetBtns()
    }
}

async function handleDoubleClick(e) {
    const { classList } = e.target
    if (classList.contains('file')) {
        download(`/api/files/${e.target.id}/download`)
    }
    if (classList.contains('folder')) {
        currDirectory = e.target.id
        await refreshTable()
    }
}
function loadDataTable() {
    document.onclick = handleClick
    document.ondblclick = handleDoubleClick
    refreshTable().then()
    resetBtns()
    fileInput.addEventListener('change', () => uploadFile())
}

loadDataTable()
