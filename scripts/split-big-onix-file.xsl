<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:r="http://ns.editeur.org/onix/3.0/reference" xmlns:s="http://ns.editeur.org/onix/3.0/short" xmlns:ro="http://www.editeur.org/onix/3.0/reference" xmlns:so="http://www.editeur.org/onix/3.0/short">
	<xsl:output method="xml" version="1.0" encoding="UTF-8" indent="yes"/>
	<xsl:strip-space elements="*"/>
	<xsl:param name="basename" select="'onixfile'"/>
	<xsl:param name="size" select="100"/>
	<xsl:param name="count-only" select="'n'"/>
	<xsl:param name="dtd-path" select="''"/>
	<xsl:variable name="top-level-element" select="name(/*[1])"/>
	<xsl:variable name="top-level-element-ns" select="namespace-uri(/*[1])"/>
	<xsl:variable name="release" select="/*[1]/@release"/>
	<xsl:variable name="header">
		<xsl:copy-of select="/ONIXMessage/*[not(self::Product)] | /ONIXmessage/*[not(self::product)] | /r:ONIXMessage/*[not(self::r:Product)] | /s:ONIXmessage/*[not(self::s:product)] | /ro:ONIXMessage/*[not(self::ro:Product)] | /so:ONIXmessage/*[not(self::so:product)]"/>
	</xsl:variable>
	<xsl:template match="/">
		<xsl:variable name="total-records" select="count(//Product | //product | //r:Product | //s:product | //ro:Product | //so:product)"/>
		<xsl:message>Total number of records: <xsl:value-of select="$total-records"/></xsl:message>
		<xsl:if test="$count-only='n'">
			<xsl:for-each select="ONIXMessage/Product | ONIXmessage/product | r:ONIXMessage/r:Product | s:ONIXmessage/s:product | ro:ONIXMessage/ro:Product | so:ONIXmessage/so:product">
				<xsl:if test="position() = ($size * floor((position() - 1) div $size)) + 1">
					<xsl:call-template name="split">
						<xsl:with-param name="offset" select="position()"/>
					</xsl:call-template>
				</xsl:if>
			</xsl:for-each>
		</xsl:if>
	</xsl:template>
	
	<xsl:template name="split">
		<xsl:param name="offset"/>
		<xsl:variable name="last-record">
			<xsl:choose>
				<xsl:when test="following-sibling::*[position() = $size - 1]"><xsl:value-of select="$offset + $size - 1"/></xsl:when>
				<xsl:otherwise><xsl:value-of select="$offset + count(following-sibling::*)"/></xsl:otherwise>
			</xsl:choose>
		</xsl:variable>
		<xsl:choose>
			<xsl:when test="not($dtd-path='')">
				<xsl:result-document href="{concat($basename,'-',$offset,'-',$last-record,'.xml')}" method="xml" doctype-system="{$dtd-path}">
					<xsl:element name="{$top-level-element}" namespace="{$top-level-element-ns}">
						<xsl:if test="$release!=''">
							<xsl:attribute name="release"><xsl:value-of select="$release"/></xsl:attribute>
						</xsl:if>
						<xsl:copy-of select="$header"/>
						<xsl:for-each select="self::* | following-sibling::*[position() &lt; $size]">
							<xsl:copy-of select="."/>
						</xsl:for-each>
					</xsl:element>
				</xsl:result-document>
			</xsl:when>
			<xsl:otherwise>
				<xsl:result-document href="{concat($basename,'-',$offset,'-',$last-record,'.xml')}" method="xml">
					<xsl:element name="{$top-level-element}" namespace="{$top-level-element-ns}">
						<xsl:if test="$release!=''">
							<xsl:attribute name="release"><xsl:value-of select="$release"/></xsl:attribute>
						</xsl:if>
						<xsl:copy-of select="$header"/>
						<xsl:for-each select="self::* | following-sibling::*[position() &lt; $size]">
							<xsl:copy-of select="."/>
						</xsl:for-each>
					</xsl:element>
				</xsl:result-document>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	
	<xsl:template match="@* | node()"/>
</xsl:stylesheet>
