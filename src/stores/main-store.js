import { observable, computed, action } from 'mobx'
import { asyncComputed } from 'computed-async-mobx'

import { downloadFile, convertFileToArrayBuffer } from '../utils/files'
import getWeb3 from '../utils/getWeb3'
import { Datastore, providers } from 'aragon-datastore'

export const EditMode = {
  None: "None",
  Name: "Name",
  Content: "Content",
  Permissions: "Permissions"
}

class MainStore {

  @observable files = []
  @observable selectedFile
  @observable editMode = EditMode.None  
  
  
  selectedFilePermissions = asyncComputed([], 100, async () => 
    this.selectedFile ?
      this._datastore.getFilePermissions(this.selectedFile.id)
      :
      []
  )

  isFileSelected(file) {
    return this.selectedFile && this.selectedFile.id === file.id
  }

  @action setEditMode(mode) {
    this.editMode = mode
  }

  @action async setFilename(fileId, newName) {
    await this._datastore.setFilename(fileId, newName)
    this.setEditMode(EditMode.None)
  }

  async uploadFiles(files) {
    // TODO: Add warning when there are multiple files

    for (let file of files) {
      const result = await convertFileToArrayBuffer(file)
      await this._datastore.addFile(file.name, result)
    }

  }

  async addWritePermission(fileId, address) {
    await this._datastore.setWritePermission(fileId, address, true)
  }

  async setFileContent(fileId, fileContent) {
    await this._datastore.setFileContent(fileId, fileContent) 
    this.setEditMode(EditMode.None)
  }

  downloadFile = async fileId => {
    const file = await this._datastore.getFile(fileId)
    downloadFile(file.content, file.name)
  }

  selectFile = async fileId => {
    if (this.selectedFile && this.selectedFile.id === fileId) 
      return this.selectedFile = null    

    const selectedFile = this.files.find(file => file && file.id === fileId)
    
    if (selectedFile)
      this.selectedFile = selectedFile
  }


  _datastore

  constructor() {
    this.initialize()
    window.mainStore = this
  }

  async initialize() {
    const results = await getWeb3

    this._datastore = new Datastore({
      storageProvider: new providers.storage.Ipfs(),
      encryptionProvider: new providers.encryption.Aes(),
      rpcProvider: new providers.rpc.Web3(results.web3)
    });

    // Very basic, refresh files each time a new event is received
    (await this._datastore.events())
      .subscribe(event => this._refreshFiles())

    this._refreshFiles()
  }

  async _refreshFiles() {
    this.files = await this._datastore.listFiles() 
    
    // Update selected file
    if (this.selectedFile) 
      this.selectedFile = this.files.find(file => file && file.id === this.selectedFile.id)
    
  }

}

export const mainStore = new MainStore()