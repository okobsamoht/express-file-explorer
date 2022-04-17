# efilex

This is an Express middleware that provides a file editing ui.

## Usage

```javascript
var fileExplorer = require('efilex');

app.use('/explorer', fileExplorer(directory));
```
then go to `http://host:port/explorer`
## License

This project is unlicenced.

#todo
* security
* tests
* filetype support