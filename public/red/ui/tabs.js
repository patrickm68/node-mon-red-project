/**
 * Copyright 2013 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
 


RED.tabs = function() {
    
    
    function createTabs(options) {
        var ul = $("#"+options.id)
        ul.addClass("red-ui-tabs");
        ul.children().first().addClass("active");
        ul.children().addClass("red-ui-tab");
        
        function onTabClick() {
            activateTab($(this));
            return false;
        }
        
        function onTabDblClick() {
            if (options.ondblclick) {
                options.ondblclick($(this).attr('href'));
            }
        }
        
        function activateTab(link) {
            if (typeof link === "string") {
                link = ul.find("a[href='#"+link+"']");
            }
            if (!link.parent().hasClass("active")) {
                ul.children().removeClass("active");
                link.parent().addClass("active");
                if (options.onchange) {
                    options.onchange(link.attr('href'));
                }
            }

        }
        function updateTabWidths() {
            var tabs = ul.find("li.red-ui-tab");
            var width = ul.width();
            var tabCount = tabs.size();
            var tabWidth = (width-6-(tabCount*7))/tabCount;
            var pct = 100*tabWidth/width;
            tabs.css({width:pct+"%"});
                
        }
        ul.find("li.red-ui-tab a").on("click",onTabClick).on("dblclick",onTabDblClick);
        updateTabWidths();
        
        return {
            addTab: function(tab) {
                var li = $("<li/>",{class:"red-ui-tab"}).appendTo(ul);
                var link = $("<a/>",{href:"#"+tab.id}).appendTo(li);
                link.html(tab.label);
                link.on("click",onTabClick);
                link.on("dblclick",onTabDblClick);
                updateTabWidths();
                if (options.onadd) {
                    options.onadd(tab);
                }
            },
            activateTab: activateTab,
            resize: updateTabWidths
        }
    }
    
    return {
        create: createTabs
    }
}();
