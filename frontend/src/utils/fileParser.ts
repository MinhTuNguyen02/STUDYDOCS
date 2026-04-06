import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'

export const getPageCount = async (file: File): Promise<number> => {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase()
    
    if (ext === 'pdf') {
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
      return pdfDoc.getPageCount()
    }
    
    if (ext === 'docx') {
      const arrayBuffer = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(arrayBuffer)
      const appXmlFile = zip.file('docProps/app.xml')
      if (appXmlFile) {
        const appXml = await appXmlFile.async('text')
        const match = appXml.match(/<Pages>(\d+)<\/Pages>/)
        if (match && match[1]) {
          return parseInt(match[1], 10)
        }
      }
      // Return 1 if can't find exact page count
      return 1
    }

    if (ext === 'pptx') {
      const arrayBuffer = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(arrayBuffer)
      const appXmlFile = zip.file('docProps/app.xml')
      if (appXmlFile) {
        const appXml = await appXmlFile.async('text')
        const match = appXml.match(/<Slides>(\d+)<\/Slides>/)
        if (match && match[1]) {
          return parseInt(match[1], 10)
        }
      }
      return 1
    }

    // For other formats (xlsx, old doc) fallback to 1
    return 1
  } catch (error) {
    console.error('Lỗi khi đọc file để đếm số trang:', error)
    return 1 // Fallback to 1 so the upload doesn't break
  }
}
