"use client";
import type {ReactNode} from "react";

export function AdminIdentity({initial,title,subtitle,aside}:{initial:string;title:string;subtitle?:string;aside?:ReactNode}) {
 return <div className="adm-identity"><span className="adm-identity-avatar" aria-hidden="true">{initial}</span><div className="adm-identity-copy"><strong>{title}</strong>{subtitle&&<small dir="auto">{subtitle}</small>}</div>{aside&&<div className="adm-identity-aside">{aside}</div>}</div>;
}
export function AdminInfoGrid({children,className=""}:{children:ReactNode;className?:string}){
 return <dl className={"adm-info-grid "+className}>{children}</dl>;
}
export function AdminInfo({label,children,wide=false,dir}:{label:string;children:ReactNode;wide?:boolean;dir?:"ltr"|"rtl"|"auto"}){
 return <div className={"adm-info-cell"+(wide?" is-wide":"")}><dt>{label}</dt><dd dir={dir}>{children}</dd></div>;
}
export function AdminCardHeader({title,description,aside}:{title:string;description?:string;aside?:ReactNode}){
 return <header className="adm-card-heading"><div><h3>{title}</h3>{description&&<p>{description}</p>}</div>{aside&&<div>{aside}</div>}</header>;
}
export function AdminActionArea({title,description,children,danger=false}:{title?:string;description?:string;children:ReactNode;danger?:boolean}){
 return <div className={"adm-action-area"+(danger?" is-danger":"")}>{(title||description)&&<div className="adm-action-copy">{title&&<strong>{title}</strong>}{description&&<p>{description}</p>}</div>}<div className="adm-action-controls">{children}</div></div>;
}
export function AdminMetrics({items}:{items:{label:string;value:ReactNode}[]}){
 return <div className="adm-mini-metrics">{items.map((item,i)=><div key={i}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>;
}
export function AdminListItem({title,subtitle,aside,footer,children}:{title:ReactNode;subtitle?:ReactNode;aside?:ReactNode;footer?:ReactNode;children?:ReactNode}){
 return <article className="adm-entity-row"><div className="adm-entity-line"><div className="adm-entity-title"><strong>{title}</strong>{subtitle&&<small>{subtitle}</small>}</div>{aside&&<div className="adm-entity-aside">{aside}</div>}</div>{children}{footer&&<div className="adm-entity-footer">{footer}</div>}</article>;
}
