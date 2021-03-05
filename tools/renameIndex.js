const fs = require('fs');

fs.readFile('../public/algolia.json', 'utf-8', (err, data) => {
    if (err) {
        throw err;
    }
    const indexes = JSON.parse(data.toString());
    for(index in indexes) {
        indexes[index].uri = "/" + indexes[index].uri
    }
    const result = JSON.stringify(indexes, null ,4);
    fs.writeFile('../public/algolia.json', result, (err) => {
        if (err) {
            throw err;
        }
        console.log("JSON data is saved.");
    });
   
});
