const fs = require("fs");
const mammoth = require("mammoth");
const pdf2html = require("pdf2html");

const express = require("express");
const router = express.Router();


const cachedTemplate = userid => `${__rootdir}/cache/${userid}`;
router.post("/upload", (req, res) => {
  const file = req.files.file;
  const userid = req.signedCookies.userid;
  if (file === undefined) return;
  
  console.log(`${userid} uploaded ${file.name}`);

  const rootPath = `${__rootdir}/uploads/all/${file.md5()}_${file.name}`;
  const userPath = `${__rootdir}/uploads/${userid}/${file.md5()}_${file.name}`;
  file.mv(rootPath)
  .then(() => {
    if(!fs.existsSync(userPath)) fs.symlinkSync(rootPath, userPath);
    
    const cachedFile = cachedTemplate(userid);
    if(fs.existsSync(cachedFile)){
      fs.unlink(cachedFile, () => res.sendStatus(200));
    }
    else {res.sendStatus(200);}
  })
  .catch(err => console.log(err));
  
  
});

router.get("/data", (req, res) => {  
  const userid = req.signedCookies.userid;  
  const cachedFile = cachedTemplate(userid);
  
  if(fs.existsSync(cachedFile)){
    res.sendFile(cachedFile);
  }else{
    const promises = [];
    const stream = fs.createWriteStream(cachedFile);
    
    stream.once("open", fd => {
      const explore = folder => {
        fs.readdirSync(folder).forEach(file => {
          const fullPath = `${folder}/${file}`;

          if (fs.lstatSync(fullPath).isDirectory()) {
            explore(fullPath);
          } else {
            if (file.endsWith(".docx")) {
              promises.push(
                mammoth.convertToHtml({ path: fullPath }).then(function(result) {
                  var html = result.value;                   
                  stream.write(`${html}\n`);
                })
              );
            }
          }
        });
      };
      explore(`uploads/${userid}`);
      
      Promise.all(promises).then(() => {   
        stream.end();
        res.sendFile(cachedFile); 
      });
    });
  }
});

module.exports = router;