import AppKit
import PDFKit

let args=CommandLine.arguments
guard args.count==3, let doc=PDFDocument(url:URL(fileURLWithPath:args[1])) else {
    fatalError("Provide the browser-generated PDF and an output folder")
}
let folder=URL(fileURLWithPath:args[2],isDirectory:true)
try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
var pages:[[String:Any]]=[]
var text=""
for i in 0..<doc.pageCount {
    guard let page=doc.page(at:i) else {fatalError("Unreadable PDF page")}
    let content=page.string ?? ""
    text += content+"\n"
    let box=page.bounds(for:.mediaBox)
    let image=page.thumbnail(of:NSSize(width:1240,height:1754),for:.mediaBox)
    guard let data=image.tiffRepresentation,
          let bitmap=NSBitmapImageRep(data:data),
          let png=bitmap.representation(using:.png,properties:[:]) else {fatalError("Page rendering failed")}
    try png.write(to:folder.appendingPathComponent("page-\(i+1).png"))
    pages.append(["page":i+1,"width":box.width,"height":box.height,"characters":content.count])
}
let required=["Ombak surf school","Raka","Nadia","Acceptance criteria","Confirmation records","Confirmed"]
let missing=required.filter{!text.localizedCaseInsensitiveContains($0)}
guard missing.isEmpty else {fatalError("Missing PDF content: \(missing)")}
guard !text.contains("/o/"),!text.contains("/c/"),!text.contains("127.0.0.1") else {fatalError("Private source URL included in printed PDF")}
guard !text.contains("Print / Save as PDF"),!text.contains("Download Markdown") else {fatalError("App controls leaked into printed PDF")}
try text.write(to:folder.appendingPathComponent("extracted.txt"),atomically:true,encoding:.utf8)
let report:[String:Any]=["pageCount":doc.pageCount,"pages":pages,"requiredContentPassed":true,"privateUrlsAbsent":true,"controlsAbsent":true]
let json=try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys])
try json.write(to:folder.appendingPathComponent("verification.json"))
print("Verified browser PDF: \(doc.pageCount) pages; required scope content present; no private URLs or app controls.")
