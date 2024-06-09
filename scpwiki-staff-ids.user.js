/*
SCP-Wiki Staff Identification

--------------------------------------------------------------------
This is a Greasemonkey user script.

To install on Firefox, you need Greasemonkey: http://greasemonkey.mozdev.org/
Then restart Firefox and revisit this script.
Under Tools, there will be a new menu item to "Install User Script".
Accept the default configuration and install.

To uninstall, go to Tools/Manage User Scripts,
select "SCP-Wiki Staff Identification", and click Uninstall.
--------------------------------------------------------------------
*/

// ==UserScript==
// @name        SCP-Wiki Staff Identification 2
// @description Shows who's staff and what position they hold
// @version     v2.2.1
// @updateURL   https://github.com/scpwiki/SCP-Wiki-Staff-Identification/raw/master/scpwiki-staff-ids.user.js
// @downloadURL https://github.com/scpwiki/SCP-Wiki-Staff-Identification/raw/master/scpwiki-staff-ids.user.js
// @include     http://scpwiki.com/forum*
// @include     http://www.scpwiki.com/forum*
// @include     http://scp-wiki.wikidot.com/forum*
// @include     http://05command.wikidot.com/forum*
// @include     https://scpwiki.com/forum*
// @include     https://www.scpwiki.com/forum*
// @include     https://scp-wiki.wikidot.com/forum*
// @include     https://05command.wikidot.com/forum*
// @grant       GM_xmlhttpRequest
// @grant       GM.xmlHttpRequest
// @require     https://code.jquery.com/jquery-3.7.1.min.js
// ==/UserScript==

"use strict";
var staff,
  doCount = 0;
var day = 1000 * 60 * 60 * 24;

// page is loaded, let's do this
getStaffList();

// we also need to do this whenever the user changes page
jQuery(document).on("click", ".pager .target a", function () {
  doCount = 0;
  setStaffIds(staff);
});

//the data should already be fetched, so we can skip the fetching step

// fetch the whole list of staff from 05command
function getStaffList() {
  var lastFetchedTimestamp = localStorage.getItem("scp-staff-ids-timestamp");
  var lastFetchedResponse = localStorage.getItem("scp-staff-ids-response");
  var useCachedResponse =
    lastFetchedTimestamp != null &&
    lastFetchedResponse != null &&
    new Date(lastFetchedTimestamp).getTime() + day > new Date().getTime();

  if (useCachedResponse) {
    console.info("SCP Wiki Staff ID: Using cached staff list");
    structureStaffList(lastFetchedResponse);
  } else {
    console.info("SCP Wiki Staff ID: Fetching new staff list");
    GM.xmlHttpRequest({
      method: "GET",
      url: "http://05command.wikidot.com/staff-list",
      timeout: 10000,
      onload: function (response) {
        localStorage.setItem("scp-staff-ids-timestamp", new Date());
        localStorage.setItem("scp-staff-ids-response", response.responseText);
        structureStaffList(response.responseText);
      },
      onerror: function () {
        console.error("An error occurred while fetching staff data");
      },
      ontimeout: function () {
        console.error("The request to fetch staff data timed out");
      },
    });
  }
}

// rummage through the list of staff and twist it into a format that JS understands
function structureStaffList(staffText) {
  var parser = new DOMParser();
  var staffList = parser
    .parseFromString(staffText, "application/xml")
    .getElementById("page-content");
  // next thing to do is to compile a list of all of the staff members
  staff = [];
  var staffType = "Staff Member";
  // 4 tables:  admin, mod, opstaff, jstaff

  for (let node = 0; node < staffList.childNodes.length; node++) {
    var currNode = staffList.childNodes[node];

    // if the current node is not a table, we don't care about it, but if it's a title then we can use it to get the current staff type instead of hardcoding that
    switch (currNode.nodeName.toLowerCase()) {
      case "table":
        break;
      case "h1":
        // do something
        staffType = currNode.firstChild.textContent;
        continue;
      default:
        continue;
    }

    // if we got here, then we need to go deeper into the table
    for (let i = 0; i < currNode.childNodes.length; i++) {
      // starting at 1 because the first tr is the title
      var tr = currNode.childNodes[i];
      // there's a lot of empty text nodes for some reason, so we ignore these
      if (tr.nodeName !== "tr") continue;

      // iterate through the columns of the tr
      var td,
        columns = [];
      for (let j = 0; j < tr.childNodes.length; j++) {
        td = tr.childNodes[j];
        // there's a lot of empty text nodes for some reason, so we remove these
        if (td.nodeName !== "td") continue;
        // so each td is, in order: user | teams | timezone | activity | contact | captain
        //                          0      1       2          3          4         5
        // for JS, only 0 and 1 exist
        // now we shove each td into a clean array so we can iterate over it without the messy text nodes ruining life for everyone
        columns.push(td);
      }

      var staffmember = {
        username: "",
        teams: [],
        active: "Active",
        captain: [],
        type: staffType,
      };

      for (let j = 0; j < columns.length; j++) {
        switch (j) {
          case 0: // username
            // extract the username from [[*user username]]
            staffmember.username =
              columns[j].childNodes[0].childNodes[1].textContent;
            break;
          case 1: // teams
            staffmember.teams = columns[j].textContent.split(", ");
            if (staffmember.teams[0] === "-") staffmember.teams = [];
            break;
          case 3: // activity
            staffmember.active = columns[j].textContent;
            break;
          case 5: // captain
            staffmember.captain = columns[j].textContent.split(", ");
            break;
        }
      }
      // now let's do something incredibly lazy to drop this member if the tr is a title
      if (staffmember.username === "") continue;
      // push staff data into the staff list
      staff.push(staffmember);
    }
  }
  setStaffIds(staff);
}

// run through the forum page and add the staff roles
function setStaffIds() {
  var container;
  if (document.getElementById("thread-container")) {
    container = document.getElementById("thread-container");
  } else {
    container = document.getElementsByClassName("thread-container")[0];
  }
  if (!container) return;

  var infoSpans = container.getElementsByClassName("info");
  var userName = "";
  var staffName, staffId;

  for (var x = 0; x < infoSpans.length; x++) {
    try {
      userName = infoSpans[x]
        .getElementsByTagName("span")[0]
        .getElementsByTagName("a")[1].innerHTML;
    } catch (error) {
      // so far as I can tell this only errors for a deleted account, so ignore it
      continue;
    }

    if (infoSpans[x].innerHTML.indexOf("SCP Wiki -") === -1) {
      staffName = "";
      staffId = "";

      for (var y = 0; y < staff.length; y++) {
        staffName = staff[y].username;

        if (userName.indexOf(staffName) !== -1) {
          // I want to format this as "Administrator - Disciplinary" or "Junior Staff - Technical" or "Operational Staff (Inactive)"
          staffId = "SCP Wiki - " + staff[y].type;

          if (staff[y].active.toLowerCase() !== "active")
            staffId += " (" + staff[y].active + ")";

          if (staff[y].captain.length > 0) {
            for (let i = 0; i < staff[y].captain.length; i++) {
              for (let j = 0; j < staff[y].teams.length; j++) {
                if (staff[y].captain[i] === staff[y].teams[j])
                  staff[y].teams[j] += " (Captain)";
              }
            }
          }
          if (staff[y].teams.length > 0)
            staffId += " - " + staff[y].teams.join(", ");
        }
      }

      if (staffId !== "") {
        var br = infoSpans[x].getElementsByTagName("br")[0];
        var staffSpan = document.createElement("span");
        staffSpan.style.fontSize = "0.8em";
        staffSpan.innerHTML = staffId + "<br>";

        if (br) {
          infoSpans[x].insertBefore(staffSpan, br.nextSibling);
        } else {
          br = document.createElement("br");
          infoSpans[x].appendChild(br);
          infoSpans[x].appendChild(staffSpan);
        }
      }
    }
  }
  // repeat this a few times just so that we catch everything if the forum loads slowly
  doCount++;
  if (doCount < 10)
    setTimeout(function () {
      setStaffIds();
    }, 500);
}
