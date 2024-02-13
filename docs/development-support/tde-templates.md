---
layout: default
title: TDE Templates
nav_order: 1
parent: Development Support
---

While developing TDE templates, you may verify that your templates are valid TDE templates. Additionally, if the template is valid, you may also use the template to extract nodes from data documents. That permits you to verify that template is extracting data as intended.

### To validate a TDE template:
1. In an editor tab, open the template file that you wish to be validated.
2. Open the VS Code command palette.
3. Select `MarkLogic: Validate TDE Template` from the list

The results of the validation will appear in the `MLXPRS: RESULTS` tab in the bottom panel.

### To extract nodes from a data document using a TDE template:
1. In an editor tab, open the template file that you wish to use for node extraction.
2. Add a "var" property with a "name" of "MLXPRS_TEST_URI" and a "val" that is the URI of the data document in the database. If there is not already a "vars" property, you will need to also add that as a child of the "template" property. Alternatively, you can extract data from a local file by using the var "name" of "MLXPRS_TEST_FILE" setting the "val" property to the path to the file. When using "MLXPRS_TEST_FILE", the path in the "val" property may be either an absolute path or a path relative to the current workspace.

For a JSON document the vars section will look something like the following:
```
    "vars":[
      {
        "name":"MLXPRS_TEST_URI",
        "val":"/citations.xml"
      }
    ]
```

For an XML document the vars section will look something like this:
```
  <vars>
    <var>
      <name>MLXPRS_TEST_FILE</name>
      <val>src/main/ml-data/citations.xml</val>
    </var>
  </vars>
```

3. Open the VS Code command palette.
4. Select `MarkLogic: Extract Data Via TDE` from the list

The results of the node extraction will appear in the `MLXPRS: RESULTS` tab in the bottom panel.
