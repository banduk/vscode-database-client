<template>
  <div id="app">
    <div class="hint">
      <div style="width:95%;">
        <el-input type="textarea" :autosize="{ minRows:2, maxRows:5}" v-model="toolbar.sql" class="sql-pannel" @keypress.native="panelInput" />
      </div>
      <Toolbar :page="page" :showFullBtn="showFullBtn" :search.sync="table.search" :costTime="result.costTime" @changePage="changePage" @sendToVscode="sendToVscode" @export="exportOption.visible = true" @insert="$refs.editor.openInsert()" @deleteConfirm="deleteConfirm" @run="info.message = false;execute(toolbar.sql);" />
      <div v-if="info.message ">
        <div v-if="info.error" class="info-panel" style="color:red !important" v-html="info.message"></div>
        <div v-if="!info.error" class="info-panel" style="color: green !important;" v-html="info.message"></div>
      </div>
    </div>
    <!-- trigger when click -->
    <div class="result-layout" :class="`result-layout--${preview.position}`">
      <div class="result-main">
        <ux-grid ref="dataTable" :data="filterData" v-loading='table.loading' size='small' :cell-style="{height: '35px'}" @sort-change="sort" :height="remainHeight" width="100vh" stripe :checkboxConfig="{ checkMethod: selectable}">
          <ux-table-column type="checkbox" width="40" fixed="left"></ux-table-column>
          <ux-table-column type="index" width="40" :seq-method="({row,rowIndex})=>(rowIndex||!row.isFilter)?rowIndex:undefined">
            <Controller slot="header" :result="result" :toolbar="toolbar" />
          </ux-table-column>
          <ux-table-column v-for="(field,index) in visibleFields" :key="index" :resizable="true" :field="field.name" :title="field.name" :sortable="true" :width="computeWidth(field,0)" edit-render>
            <Header slot="header" slot-scope="scope" :result="result" :scope="scope" :index="index" />
            <Row slot-scope="scope" :scope="scope" :result="result" :filterObj="toolbar.filter" :editList.sync="update.editList" :selectedCell="selectedCell" :hasFilterRow="hasFilterRow" @execute="execute" @sendToVscode="sendToVscode" @openEditor="openEditor" @cellSelected="onCellSelected" />
          </ux-table-column>
        </ux-grid>
      </div>
      <div class="result-preview" v-if="preview.visible">
        <div class="result-preview__header">
          <div class="result-preview__title">Preview</div>
          <div class="result-preview__actions">
            <el-switch v-model="preview.pinned" active-text="Pinned" inactive-text="Floating" @change="savePreviewSettings"></el-switch>
            <el-select v-model="preview.position" size="mini" class="result-preview__position" @change="savePreviewSettings">
              <el-option label="Right" value="right"></el-option>
              <el-option label="Bottom" value="bottom"></el-option>
            </el-select>
            <el-button size="mini" @click="preview.visible = false; savePreviewSettings()">Hide</el-button>
          </div>
        </div>
        <div class="result-preview__content" v-if="selectedField">
          <div class="result-preview__meta">
            <span class="result-preview__field">{{ selectedField.name }}</span>
            <span class="result-preview__type" v-if="selectedField.type">{{ selectedField.type }}</span>
          </div>
          <div class="result-preview__format">
            <span class="result-preview__label">Format</span>
            <el-select v-model="columnFormatter" size="mini" @change="savePreviewSettings">
              <el-option label="Auto" value="auto"></el-option>
              <el-option label="Raw" value="raw"></el-option>
              <el-option label="JSON" value="json"></el-option>
              <el-option label="Array" value="array"></el-option>
              <el-option label="Text" value="text"></el-option>
            </el-select>
          </div>
          <div class="result-preview__value">
            <pre v-if="previewContent.isPre">{{ previewContent.text }}</pre>
            <span v-else>{{ previewContent.text }}</span>
          </div>
        </div>
        <div class="result-preview__empty" v-else>
          Select a cell to preview.
        </div>
      </div>
    </div>
    <EditDialog ref="editor" :dbType="result.dbType" :result="result" :database="result.database" :table="result.table" :primaryKey="result.primaryKey" :primaryKeyList="result.primaryKeyList" :columnList="result.columnList" @execute="execute" />
    <ExportDialog :visible.sync="exportOption.visible" @exportHandle="confirmExport" />
  </div>
</template>

<script>
import { getVscodeEvent } from "../util/vscode";
import Row from "./component/Row";
import Controller from "./component/Row/Controller.vue";
import Header from "./component/Row/Header.vue";
import ExportDialog from "./component/ExportDialog.vue";
import Toolbar from "./component/Toolbar";
import EditDialog from "./component/EditDialog";
import { util } from "./mixin/util";
import { normalizeCellValue, formatPreviewValue } from "./previewUtil";
import { wrapByDb } from "@/common/wrapper";
let vscodeEvent;

export default {
  mixins: [util],
  components: {
    ExportDialog,
    EditDialog,
    Toolbar,
    Controller,
    Row,
    Header,
  },
  data() {
    return {
      showFullBtn: false,
      remainHeight: 0,
      connection: {},
      result: {
        data: [],
        dbType: "",
        costTime: 0,
        sql: "",
        primaryKey: null,
        columnList: null,
        primaryKeyList: null,
        database: null,
        table: null,
        tableCount: null,
      },
      page: {
        pageNum: 1,
        pageSize: -1,
        total: null,
      },
      table: {
        search: "",
        loading: true,
        widthItem: {},
      },
      toolbar: {
        sql: null,
        // using to clear filter input value
        filter: {},
        showColumns: [],
      },
      exportOption: {
        visible: false,
      },
      info: {
        sql: null,
        message: null,
        error: false,
        needRefresh: true,
      },
      update: {
        editList: {},
        lock: false,
      },
      preview: {
        visible: true,
        pinned: true,
        position: "right",
        formatterByColumn: {},
      },
      selectedCell: {
        rowIndex: null,
        fieldIndex: null,
        fieldName: null,
      },
    };
  },
  mounted() {
    this.remainHeight = window.innerHeight - 90;
    this.showFullBtn = window.outerWidth / window.innerWidth >= 2;
    window.addEventListener("resize", () => {
      this.remainHeight = window.innerHeight - 90;
      this.showFullBtn = window.outerWidth / window.innerWidth >= 2;
    });
    const handlerData = (data, sameTable) => {
      this.result = data;
      this.toolbar.sql = data.sql;
      this.clearSelection();

      if (sameTable) {
        this.clear();
      } else {
        this.reset();
      }
      // only es have.
      if (data.total != null) {
        this.page.total = parseInt(data.total);
      } else if (
        this.result.tableCount == 1 &&
        this.page.pageSize < this.result.data.length + 1
      ) {
        this.count();
      } else {
        this.page.total = this.result.data.length - 1;
      }
      this.update.editList = [];
      this.update.lock = false;
    };
    const handlerCommon = (res) => {
      if (this.$refs.editor) {
        this.$refs.editor.close();
      }
      this.info.message = res.message;
    };
    vscodeEvent = getVscodeEvent();

    vscodeEvent.on("updateSuccess", () => {
      for (const index in this.update.editList) {
        const element = this.update.editList[index];
        this.result.data[index] = element;
      }
      this.update.editList = [];
      this.update.lock = false;
      this.$message({
        showClose: true,
        duration: 500,
        message: "Update Success",
        type: "success",
      });
    });
    window.onkeypress = (e) => {
      if (
        (e.code == "Enter" && e.target.classList.contains("edit-column")) ||
        (e.ctrlKey && e.code == "KeyS")
      ) {
        this.save();
        e.stopPropagation();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("message", ({ data }) => {
      if (!data) return;
      const response = data.content;
      console.log(data);
      this.result.transId=response.transId;
      this.table.loading = false;
      switch (data.type) {
        case "EXPORT_DONE":
          this.exportOption.visible = false;
          break;
        case "RUN":
          this.toolbar.sql = response.sql;
          this.table.loading = response.transId != this.result.transId;
          break;
        case "DATA":
          handlerData(response);
          break;
        case "NEXT_PAGE":
          this.result.data = response.data;
          this.result.costTime=response.costTime;
          this.toolbar.sql = response.sql;
          this.result.data.unshift({ isFilter: true, content: "" });
          break;
        case "COUNT":
          this.page.total = parseInt(response.data);
          break;
        case "DML":
        case "DDL":
        case "MESSAGE_BLOCK":
          handlerCommon(response);
          this.info.error = false;
          this.info.needRefresh = false;
          if (
            response.message.indexOf("AffectedRows") != -1 ||
            response.isInsert
          ) {
            this.refresh();
          }
          break;
        case "ERROR":
          handlerCommon(response);
          this.info.error = true;
          break;
        case "MESSAGE":
          if (response.message) {
            this.$message({
              showClose: true,
              duration: 1000,
              message: response.message,
              type: response.success ? "success" : "error",
            });
          }
          this.refresh();
          break;
      }
    });
    vscodeEvent.emit("init");
    window.addEventListener("keyup", (event) => {
      if (event.key == "c" && event.ctrlKey) {
        document.execCommand("copy");
      }
    });
    this.loadPreviewSettings();
  },
  methods: {
    loadPreviewSettings() {
      try {
        const raw = window.localStorage.getItem("dbclient.preview.settings");
        if (raw) {
          const parsed = JSON.parse(raw);
          this.preview = {
            ...this.preview,
            ...parsed,
            formatterByColumn: parsed.formatterByColumn || {},
          };
        }
      } catch (e) {
        // ignore
      }
    },
    savePreviewSettings() {
      try {
        window.localStorage.setItem(
          "dbclient.preview.settings",
          JSON.stringify({
            visible: this.preview.visible,
            pinned: this.preview.pinned,
            position: this.preview.position,
            formatterByColumn: this.preview.formatterByColumn,
          })
        );
      } catch (e) {
        // ignore
      }
    },
    panelInput(event){
      if(event.code=='Enter' && event.ctrlKey){
        this.execute(this.toolbar.sql)
        event.stopPropagation()
      }
    },
    selectable({row}) {
      return this.editable && !row.isFilter;
    },
    save() {
      if (Object.keys(this.update.editList).length == 0 && this.update.lock) {
        return;
      }
      this.update.lock = true;
      let sql = "";
      for (const index in this.update.editList) {
        const element = this.update.editList[index];
        sql += this.$refs.editor.buildUpdateSql(
          element,
          this.result.data[index]
        );
      }
      if (sql) {
        vscodeEvent.emit("saveModify", sql);
      }
    },
    sendToVscode(event, param) {
      vscodeEvent.emit(event, param);
    },
    openEditor(row, isCopy) {
      if (isCopy) {
        this.$refs.editor.openCopy(row);
      } else {
        this.$refs.editor.openEdit(row);
      }
    },
    clearSelection() {
      this.selectedCell.rowIndex = null;
      this.selectedCell.fieldIndex = null;
      this.selectedCell.fieldName = null;
    },
    onCellSelected(payload) {
      if (!payload || payload.isFilter) return;
      const rowIndex = payload.rowIndex;
      if (rowIndex < 0 || rowIndex >= this.displayRows.length) return;
      const fieldIndex = this.visibleFields.findIndex(
        (field) => field.name === payload.field
      );
      if (fieldIndex === -1) return;
      this.selectedCell.rowIndex = rowIndex;
      this.selectedCell.fieldIndex = fieldIndex;
      this.selectedCell.fieldName = this.visibleFields[fieldIndex].name;
      if (!this.preview.visible) {
        this.preview.visible = true;
        this.savePreviewSettings();
      }
    },
    onKeyDown(event) {
      const key = event.key;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
        return;
      }
      const target = event.target;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (this.displayRows.length === 0 || this.visibleFields.length === 0) {
        return;
      }
      if (this.selectedCell.rowIndex == null || this.selectedCell.fieldIndex == null) {
        this.selectedCell.rowIndex = 0;
        this.selectedCell.fieldIndex = 0;
        this.selectedCell.fieldName = this.visibleFields[0].name;
        return;
      }
      let nextRow = this.selectedCell.rowIndex;
      let nextField = this.selectedCell.fieldIndex;
      switch (key) {
        case "ArrowUp":
          nextRow = Math.max(0, nextRow - 1);
          break;
        case "ArrowDown":
          nextRow = Math.min(this.displayRows.length - 1, nextRow + 1);
          break;
        case "ArrowLeft":
          nextField = Math.max(0, nextField - 1);
          break;
        case "ArrowRight":
          nextField = Math.min(this.visibleFields.length - 1, nextField + 1);
          break;
      }
      this.selectedCell.rowIndex = nextRow;
      this.selectedCell.fieldIndex = nextField;
      this.selectedCell.fieldName = this.visibleFields[nextField].name;
      event.preventDefault();
    },
    normalizeCellValue,
    formatPreviewValue,
    confirmExport(exportOption) {
      vscodeEvent.emit("export", {
        option: {
          ...exportOption,
          sql: this.result.sql,
          table: this.result.table,
        },
      });
    },
    sort(row) {
      if (this.result.dbType == "ElasticSearch") {
        vscodeEvent.emit("esSort", [{ [row.prop]: { order: row.order } }]);
        return;
      }
      let sortSql = this.result.sql
        .replace(/\n/, " ")
        .replace(";", "")
        .replace(/order by .+? (desc|asc)?/gi, "")
        .replace(/\s?(limit.+)?$/i, ` ORDER BY ${row.prop} ${row.order} \$1 `);
      this.execute(sortSql + ";");
    },
    getTypeByColumn(key) {
      if (!this.result.columnList) return;
      for (const column of this.result.columnList) {
        if (column.name === key) {
          return column.simpleType || column.type;
        }
      }
    },
    deleteConfirm() {
      const datas = this.$refs.dataTable.getCheckboxRecords();
      if (!datas || datas.length == 0) {
        this.$message({
          type: "warning",
          message: "You need to select at least one row of data.",
        });
        return;
      }
      this.$confirm("Are you sure you want to delete this data?", "Warning", {
        confirmButtonText: "OK",
        cancelButtonText: "Cancel",
        type: "warning",
      })
        .then(() => {
          let checkboxRecords = datas
            .filter(
              (checkboxRecord) => checkboxRecord[this.result.primaryKey] != null
            )
            .map((checkboxRecord) =>
              this.wrapQuote(
                this.getTypeByColumn(this.result.primaryKey),
                checkboxRecord[this.result.primaryKey]
              )
            );
          let deleteSql = null;
          if (this.result.dbType == "ElasticSearch") {
            deleteSql =
              checkboxRecords.length > 1
                ? `POST /_bulk\n${checkboxRecords
                    .map(
                      (c) =>
                        `{ "delete" : { "_index" : "${this.result.table}", "_id" : "${c}" } }`
                    )
                    .join("\n")}`
                : `DELETE /${this.result.table}/_doc/${checkboxRecords[0]}`;
          } else if (this.result.dbType == "MongoDB") {
            deleteSql = `db('${this.result.database}').collection("${
              this.result.table
            }")
              .deleteMany({_id:{$in:[${checkboxRecords.join(",")}]}})`;
          } else {
            const table=wrapByDb(this.result.table,this.result.dbType);
            deleteSql =
              checkboxRecords.length > 1
                ? `DELETE FROM ${table} WHERE ${this.result.primaryKey} in (${checkboxRecords.join(",")})`
                : `DELETE FROM ${table} WHERE ${this.result.primaryKey}=${checkboxRecords[0]}`;
          }
          this.execute(deleteSql);
        })
        .catch((e) => {
          if (e) {
            this.$message.error(e);
          } else {
            this.$message({ type: "warning", message: "Delete canceled" });
          }
        });
    },
    /**
     * compute column row width, get maxium of fieldName or value or fieldType by top 10 row.
     */
    computeWidth(field, index) {
      // only compute once.
      let key = field.name;
      if (this.table.widthItem[key]) return this.table.widthItem[key];
      if (!index) index = 0;
      if (!this.result.data[index] || index > 10) return 70;
      const value = this.result.data[index][key];
      var dynamic = Math.max(
        (key + "").length * 10,
        (value + "").length * 10,
        (field.type + "").length * 10
      );
      if (dynamic > 150) dynamic = 150;
      if (dynamic < 70) dynamic = 70;
      var nextDynamic = this.computeWidth(field, index + 1);
      if (dynamic < nextDynamic) dynamic = nextDynamic;
      // cache column width
      this.table.widthItem[key] = dynamic;
      return dynamic;
    },
    refresh() {
      if (this.result.sql) {
        this.execute(this.result.sql);
      }
    },
    count() {
      if (!this.result.table) return;
      this.info.message = null;
      vscodeEvent.emit("count", { sql: this.result.sql });
    },
    execute(sql) {
      if (!sql) return;
      vscodeEvent.emit("execute", {
        sql,
      });
      this.table.loading = true;
    },
    changePage(pageNum, jump) {
      vscodeEvent.emit("next", {
        sql: this.result.sql,
        pageNum: jump ? pageNum : this.page.pageNum + pageNum,
        pageSize: this.page.pageSize,
      });
      this.table.loading = true;
    },

    initShowColumn() {
      const fields = this.result.fields;
      if (!fields) return;
      this.toolbar.showColumns = [];
      for (let i = 0; i < fields.length; i++) {
        if (!fields[i].name) continue;
        this.toolbar.showColumns.push(fields[i].name.toLowerCase());
      }
    },
    // show call when load same table data
    clear() {
      // reset page
      this.page.pageNum = 1;
      this.page.pageSize = this.result.pageSize;
      this.page.total = null;
      // info
      if (this.info.needRefresh) {
        this.info.message = null;
      } else {
        this.info.needRefresh = true;
      }
      // loading
      this.table.loading = false;
    },
    // show call when change table
    reset() {
      this.clear();
      // table
      this.table.widthItem = {};
      this.initShowColumn();
      // add filter row
      if (this.result.columnList) {
        this.result.data.unshift({ isFilter: true, content: "" });
      }
      // toolbar
      if (!this.result.sql.match(/\bwhere\b/gi)) {
        this.toolbar.filter = {};
        this.$refs.dataTable.clearSort();
      }
    },
  },
  computed: {
    visibleFields() {
      return (this.result.fields || []).filter((field) =>
        this.toolbar.showColumns.includes(field.name.toLowerCase())
      );
    },
    displayRows() {
      return this.filterData.filter((row) => !row.isFilter);
    },
    hasFilterRow() {
      return this.filterData[0] && this.filterData[0].isFilter;
    },
    selectedField() {
      if (
        this.selectedCell.fieldIndex == null ||
        this.selectedCell.fieldIndex < 0 ||
        this.selectedCell.fieldIndex >= this.visibleFields.length
      ) {
        return null;
      }
      return this.visibleFields[this.selectedCell.fieldIndex];
    },
    selectedRow() {
      if (
        this.selectedCell.rowIndex == null ||
        this.selectedCell.rowIndex < 0 ||
        this.selectedCell.rowIndex >= this.displayRows.length
      ) {
        return null;
      }
      return this.displayRows[this.selectedCell.rowIndex];
    },
    columnFormatter: {
      get() {
        if (!this.selectedField) return "auto";
        return this.preview.formatterByColumn[this.selectedField.name] || "auto";
      },
      set(value) {
        if (!this.selectedField) return;
        this.preview.formatterByColumn[this.selectedField.name] = value;
      },
    },
    previewContent() {
      if (!this.selectedField || !this.selectedRow) {
        return { text: "", isPre: false };
      }
      const value = this.selectedRow[this.selectedField.name];
      return this.formatPreviewValue(value, this.columnFormatter);
    },
    filterData() {
      return this.result.data.filter(
        (data) =>
          !this.table.search ||
          JSON.stringify(data)
            .toLowerCase()
            .includes(this.table.search.toLowerCase())
      );
    },
    editable() {
      return this.result.primaryKey && this.result.tableCount == 1;
    },
    columnCount() {
      if (this.result.data == undefined || this.result.data[0] == undefined)
        return 0;
      return Object.keys(this.result.data[0]).length;
    },
  },
};
</script>
