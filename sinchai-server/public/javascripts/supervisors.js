// Exp 4.2 - reads the static JSON file with fetch() and builds the table (textContent, so data is never parsed as HTML)
fetch('/data/supervisors.json')
  .then(function (r) { return r.json(); })
  .then(function (data) {
    var body = document.querySelector('#tbl tbody');
    data.supervisors.forEach(function (s) {
      var tr = document.createElement('tr');
      [s.id, s.name, s.role, s.department, s.city].forEach(function (value) {
        var td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  });
